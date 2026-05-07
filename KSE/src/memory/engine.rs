use std::path::{Path, PathBuf};
use std::fs;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::collections::{HashMap, HashSet};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{info, error, debug};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SerializationFormat {
    Json,
    Toml,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    pub data_dir: PathBuf,
    pub format: SerializationFormat,
    pub auto_save: bool,
    pub auto_save_interval_sec: u64,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            data_dir: PathBuf::from("data"),
            format: SerializationFormat::Json,
            auto_save: false,
            auto_save_interval_sec: 60,
        }
    }
}

/// Persistent memory storage engine for KSE.
/// Loads values into memory on init, writes to disk on save/flush.
pub struct MemoryEngine {
    config: MemoryConfig,
    /// In-memory cache of all loaded/saved values
    pub(crate) cache: Arc<Mutex<HashMap<String, Value>>>,
    /// Keys that have been modified but not yet flushed
    pub(crate) dirty: Arc<Mutex<HashSet<String>>>,
}

impl MemoryEngine {
    /// Create a new MemoryEngine, loading any existing data from disk.
    pub fn new(config: MemoryConfig) -> Result<Self> {
        fs::create_dir_all(&config.data_dir)
            .with_context(|| format!("Creating data dir: {:?}", config.data_dir))?;

        let engine = Self {
            config,
            cache: Arc::new(Mutex::new(HashMap::new())),
            dirty: Arc::new(Mutex::new(HashSet::new())),
        };

        engine.load_all()?;
        Ok(engine)
    }

    /// Sanitize a key for safe filesystem usage.
    fn sanitize_key(key: &str) -> String {
        key.chars()
            .map(|c| match c {
                '/' | '\\' | ':' | ' ' | '?' | '*' | '"' | '<' | '>' | '|' => '_',
                _ => c,
            })
            .collect()
    }

    /// Map a key to its on-disk file path.
    fn key_to_path(&self, key: &str) -> PathBuf {
        let safe = Self::sanitize_key(key);
        let ext = match self.config.format {
            SerializationFormat::Json => "json",
            SerializationFormat::Toml => "toml",
        };
        self.config.data_dir.join(format!("{}.{}", safe, ext))
    }

    /// Load all existing data files from disk into the cache.
    pub fn load_all(&self) -> Result<()> {
        let entries = fs::read_dir(&self.config.data_dir)
            .with_context(|| format!("Reading data dir: {:?}", self.config.data_dir))?;

        let mut cache = self.cache.lock().unwrap();

        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let ext = path.extension().and_then(|s| s.to_str());
            let expected_ext = match self.config.format {
                SerializationFormat::Json => "json",
                SerializationFormat::Toml => "toml",
            };

            if ext != Some(expected_ext) {
                continue;
            }

            let stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            let content = fs::read_to_string(&path)
                .with_context(|| format!("Reading file: {:?}", path))?;

            let value = match self.config.format {
                SerializationFormat::Json => serde_json::from_str(&content)
                    .with_context(|| format!("Parsing JSON: {:?}", path))?,
                SerializationFormat::Toml => {
                    let val: Value = toml::from_str(&content)
                        .with_context(|| format!("Parsing TOML: {:?}", path))?;
                    val
                }
            };

            debug!("Loaded key '{}' from {:?}", stem, path);
            cache.insert(stem, value);
        }

        Ok(())
    }

    /// Load a single value from cache by key. Returns None if not found.
    pub fn load(&self, key: &str) -> Option<Value> {
        let cache = self.cache.lock().unwrap();
        cache.get(key).cloned()
    }

    /// Save a value to disk and update the cache. Returns the file path on success.
    pub fn save(&self, key: &str, value: Value) -> Result<PathBuf> {
        let path = self.key_to_path(key);
        let content = match self.config.format {
            SerializationFormat::Json => serde_json::to_string_pretty(&value)
                .context("Serializing to JSON")?,
            SerializationFormat::Toml => {
                toml::to_string_pretty(&value)
                    .context("Serializing to TOML")?
            }
        };

        fs::write(&path, &content)
            .with_context(|| format!("Writing to {:?}", path))?;

        let mut cache = self.cache.lock().unwrap();
        cache.insert(key.to_string(), value);

        let mut dirty = self.dirty.lock().unwrap();
        dirty.remove(key);

        info!("Saved key '{}' to {:?}", key, path);
        Ok(path)
    }

    /// Delete a key from disk and cache.
    pub fn delete(&self, key: &str) -> Result<()> {
        let path = self.key_to_path(key);
        if path.exists() {
            fs::remove_file(&path)
                .with_context(|| format!("Deleting {:?}", path))?;
        }

        let mut cache = self.cache.lock().unwrap();
        cache.remove(key);

        let mut dirty = self.dirty.lock().unwrap();
        dirty.remove(key);

        info!("Deleted key '{}'", key);
        Ok(())
    }

    /// List all keys currently in cache.
    pub fn list(&self) -> Vec<String> {
        let cache = self.cache.lock().unwrap();
        let mut keys: Vec<String> = cache.keys().cloned().collect();
        keys.sort();
        keys
    }

    /// Force-sync all cached values to disk.
    pub fn flush(&self) -> Result<()> {
        let cache = self.cache.lock().unwrap();
        for (key, value) in cache.iter() {
            let path = self.key_to_path(key);
            let content = match self.config.format {
                SerializationFormat::Json => serde_json::to_string_pretty(value)
                    .context("Serializing to JSON")?,
                SerializationFormat::Toml => {
                    let val = value.clone();
                    toml::to_string_pretty(&val)
                        .context("Serializing to TOML")?
                }
            };
            fs::write(&path, content)
                .with_context(|| format!("Flushing {:?}", path))?;
        }

        let mut dirty = self.dirty.lock().unwrap();
        dirty.clear();

        info!("Flushed {} keys to disk", cache.len());
        Ok(())
    }

    /// Mark a key as dirty (modified in memory, needs auto-save).
    pub fn mark_dirty(&self, key: &str) {
        let mut dirty = self.dirty.lock().unwrap();
        dirty.insert(key.to_string());
        debug!("Marked '{}' as dirty", key);
    }

    /// Background auto-save task. Periodically writes dirty keys to disk.
    pub async fn auto_save(self: Arc<Self>, interval_sec: u64) {
        let mut ticker = tokio::time::interval(Duration::from_secs(interval_sec));
        loop {
            ticker.tick().await;

            let dirty_keys: Vec<String> = {
                let mut dirty = self.dirty.lock().unwrap();
                let keys: Vec<String> = dirty.iter().cloned().collect();
                dirty.clear();
                keys
            };

            if dirty_keys.is_empty() {
                continue;
            }

            debug!("Auto-saving {} dirty keys", dirty_keys.len());

            for key in dirty_keys {
                let cache = self.cache.lock().unwrap();
                if let Some(value) = cache.get(&key) {
                    let path = self.key_to_path(&key);
                    let content = match self.config.format {
                        SerializationFormat::Json => {
                            serde_json::to_string_pretty(value).unwrap_or_default()
                        }
                        SerializationFormat::Toml => {
                            toml::to_string_pretty(value).unwrap_or_default()
                        }
                    };
                    if let Err(e) = fs::write(&path, content) {
                        error!("Auto-save failed for '{}': {}", key, e);
                        let mut dirty = self.dirty.lock().unwrap();
                        dirty.insert(key);
                    } else {
                        debug!("Auto-saved key '{}' to {:?}", key, path);
                    }
                }
            }
        }
    }
}
