use kse::memory::{MemoryEngine, MemoryConfig, SerializationFormat, KnowledgeGraph};
use std::path::PathBuf;
use std::fs;
use std::sync::Arc;
use serde_json::json;

/// Create a temp directory helper. Using std::env::temp_dir + random suffix
/// to avoid adding tempfile crate (tests run single-threaded in cargo test by default).
fn make_test_dir(name: &str) -> PathBuf {
    let mut dir = std::env::temp_dir();
    let suffix = format!("kse_test_{}_{}", name, std::process::id());
    dir.push(suffix);
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn test_memory_engine_save_and_load() {
    let dir = make_test_dir("save_load");
    let config = MemoryConfig {
        data_dir: dir.clone(),
        format: SerializationFormat::Json,
        auto_save: false,
        auto_save_interval_sec: 60,
    };

    let engine = MemoryEngine::new(config).unwrap();
    let value = json!({"name": "test", "value": 42});

    engine.save("my_key", value.clone()).unwrap();
    let loaded = engine.load("my_key").unwrap();

    assert_eq!(loaded, value);
}

#[test]
fn test_memory_engine_delete() {
    let dir = make_test_dir("delete");
    let config = MemoryConfig {
        data_dir: dir.clone(),
        format: SerializationFormat::Json,
        auto_save: false,
        auto_save_interval_sec: 60,
    };

    let engine = MemoryEngine::new(config).unwrap();
    engine.save("key1", json!("hello")).unwrap();

    assert!(engine.load("key1").is_some());
    engine.delete("key1").unwrap();
    assert!(engine.load("key1").is_none());

    // File should also be gone
    assert!(!dir.join("key1.json").exists());
}

#[test]
fn test_memory_engine_list() {
    let dir = make_test_dir("list");
    let config = MemoryConfig {
        data_dir: dir.clone(),
        format: SerializationFormat::Json,
        auto_save: false,
        auto_save_interval_sec: 60,
    };

    let engine = MemoryEngine::new(config).unwrap();
    engine.save("alpha", json!(1)).unwrap();
    engine.save("beta", json!(2)).unwrap();
    engine.save("gamma", json!(3)).unwrap();

    let keys = engine.list();
    assert_eq!(keys, vec!["alpha", "beta", "gamma"]);
}

#[test]
fn test_memory_engine_flush() {
    let dir = make_test_dir("flush");
    let config = MemoryConfig {
        data_dir: dir.clone(),
        format: SerializationFormat::Json,
        auto_save: false,
        auto_save_interval_sec: 60,
    };

    let engine = MemoryEngine::new(config).unwrap();
    engine.save("a", json!(1)).unwrap();
    engine.save("b", json!(2)).unwrap();

    // Manually delete one file to verify flush recreates it
    fs::remove_file(dir.join("a.json")).unwrap();
    assert!(!dir.join("a.json").exists());

    engine.flush().unwrap();

    assert!(dir.join("a.json").exists());
    assert!(dir.join("b.json").exists());

    let content_a: serde_json::Value = serde_json::from_str(&fs::read_to_string(dir.join("a.json")).unwrap()).unwrap();
    assert_eq!(content_a, json!(1));
}

#[test]
fn test_memory_engine_load_all() {
    let dir = make_test_dir("load_all");
    fs::write(dir.join("existing.json"), r#"{"status": "ok"}"#).unwrap();

    let config = MemoryConfig {
        data_dir: dir.clone(),
        format: SerializationFormat::Json,
        auto_save: false,
        auto_save_interval_sec: 60,
    };

    let engine = MemoryEngine::new(config).unwrap();
    let loaded = engine.load("existing").unwrap();
    assert_eq!(loaded, json!({"status": "ok"}));
}

#[test]
fn test_memory_engine_toml_format() {
    let dir = make_test_dir("toml");
    let config = MemoryConfig {
        data_dir: dir.clone(),
        format: SerializationFormat::Toml,
        auto_save: false,
        auto_save_interval_sec: 60,
    };

    let engine = MemoryEngine::new(config).unwrap();
    // TOML doesn't support null, so keep it simple
    let value = json!({"name": "toml_test", "count": 7});

    engine.save("toml_key", value.clone()).unwrap();
    let loaded = engine.load("toml_key").unwrap();
    assert_eq!(loaded, value);

    // Verify file extension
    assert!(dir.join("toml_key.toml").exists());
}

#[tokio::test]
async fn test_memory_engine_auto_save() {
    let dir = make_test_dir("auto_save");
    let config = MemoryConfig {
        data_dir: dir.clone(),
        format: SerializationFormat::Json,
        auto_save: true,
        auto_save_interval_sec: 1,
    };

    let engine = Arc::new(MemoryEngine::new(config).unwrap());

    // Initial save
    engine.save("auto", json!({"test": true})).unwrap();
    assert!(dir.join("auto.json").exists());

    // Now modify cache directly and mark dirty
    {
        let mut cache = engine.cache.lock().unwrap();
        cache.insert("auto".to_string(), json!({"test": true, "updated": 1}));
    }
    engine.mark_dirty("auto");

    // Remove the file to prove auto-save recreates it
    fs::remove_file(dir.join("auto.json")).unwrap();
    assert!(!dir.join("auto.json").exists());

    let engine_clone = engine.clone();
    let handle = tokio::spawn(async move {
        engine_clone.auto_save(1).await;
    });

    // Let it tick at least once
    tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
    handle.abort();

    // Auto-save should have recreated the file with updated content
    assert!(
        dir.join("auto.json").exists(),
        "Auto-save should have written the file"
    );

    let content = fs::read_to_string(dir.join("auto.json")).unwrap();
    let val: serde_json::Value = serde_json::from_str(&content).unwrap();
    assert_eq!(val.get("updated").and_then(|v| v.as_i64()), Some(1));
}

#[test]
fn test_knowledge_graph_add_node_and_edge() {
    let mut graph = KnowledgeGraph::new();
    graph.add_node("n1".to_string(), "concept".to_string(), json!({"name": "Rust"}));
    graph.add_node("n2".to_string(), "concept".to_string(), json!({"name": "Lua"}));
    graph.add_edge("n1".to_string(), "n2".to_string(), "embeds".to_string());

    let node = graph.get_node("n1").unwrap();
    assert_eq!(node.id, "n1");
    assert_eq!(node.node_type, "concept");

    let edges = graph.query_edges("n1");
    assert_eq!(edges.len(), 1);
    assert_eq!(edges[0].to, "n2");
    assert_eq!(edges[0].label, "embeds");

    let incoming = graph.query_incoming_edges("n2");
    assert_eq!(incoming.len(), 1);
    assert_eq!(incoming[0].from, "n1");
}

#[test]
fn test_knowledge_graph_save_and_load() {
    let dir = make_test_dir("graph");
    let path = dir.join("graph.json");

    let mut graph = KnowledgeGraph::new();
    graph.add_node("a".to_string(), "test".to_string(), json!({"x": 1}));
    graph.add_node("b".to_string(), "test".to_string(), json!({"y": 2}));
    graph.add_edge("a".to_string(), "b".to_string(), "links".to_string());

    graph.save_to_file(&path).unwrap();
    let loaded = KnowledgeGraph::load_from_file(&path).unwrap();

    assert!(loaded.get_node("a").is_some());
    assert!(loaded.get_node("b").is_some());
    assert_eq!(loaded.query_edges("a").len(), 1);
    assert_eq!(loaded.nodes.len(), 2);
    assert_eq!(loaded.edges.len(), 1);

    // Verify round-trip equality
    assert_eq!(graph, loaded);
}

#[test]
fn test_key_sanitization() {
    let dir = make_test_dir("sanitize");
    let config = MemoryConfig {
        data_dir: dir.clone(),
        format: SerializationFormat::Json,
        auto_save: false,
        auto_save_interval_sec: 60,
    };

    let engine = MemoryEngine::new(config).unwrap();
    engine.save("unsafe/key:with\\stuff", json!("safe")).unwrap();

    let loaded = engine.load("unsafe/key:with\\stuff").unwrap();
    assert_eq!(loaded, json!("safe"));

    let file = dir.join("unsafe_key_with_stuff.json");
    assert!(file.exists());
}

#[test]
fn test_memory_engine_default_config() {
    let config = MemoryConfig::default();
    assert_eq!(config.data_dir, PathBuf::from("data"));
    assert_eq!(config.format, SerializationFormat::Json);
    assert!(!config.auto_save);
    assert_eq!(config.auto_save_interval_sec, 60);
}

#[test]
fn test_knowledge_graph_get_node_mut() {
    let mut graph = KnowledgeGraph::new();
    graph.add_node("n1".to_string(), "type".to_string(), json!({"x": 1}));

    {
        let node = graph.get_node_mut("n1").unwrap();
        node.properties = json!({"x": 2, "updated": true});
    }

    let node = graph.get_node("n1").unwrap();
    assert_eq!(node.properties, json!({"x": 2, "updated": true}));
}

#[test]
fn test_delete_nonexistent_key_no_panic() {
    let dir = make_test_dir("del_none");
    let config = MemoryConfig {
        data_dir: dir.clone(),
        format: SerializationFormat::Json,
        auto_save: false,
        auto_save_interval_sec: 60,
    };

    let engine = MemoryEngine::new(config).unwrap();
    // Should not panic even if key doesn't exist
    engine.delete("does_not_exist").unwrap();
    assert!(engine.load("does_not_exist").is_none());
}
