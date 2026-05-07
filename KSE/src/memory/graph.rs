use std::collections::HashMap;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{info, debug};

/// A node in the knowledge graph.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Node {
    pub id: String,
    pub node_type: String,
    pub properties: Value,
}

/// An edge connecting two nodes with a semantic label.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Edge {
    pub from: String,
    pub to: String,
    pub label: String,
}

/// In-memory knowledge graph with JSON serialization.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KnowledgeGraph {
    pub nodes: HashMap<String, Node>,
    pub edges: Vec<Edge>,
}

impl KnowledgeGraph {
    /// Create an empty knowledge graph.
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: Vec::new(),
        }
    }

    /// Add a node to the graph. Overwrites if the id already exists.
    pub fn add_node(&mut self, id: String, node_type: String, properties: Value) -> &mut Node {
        let node = Node {
            id: id.clone(),
            node_type,
            properties,
        };
        self.nodes.insert(id.clone(), node);
        self.nodes.get_mut(&id).unwrap()
    }

    /// Add a directed edge between two nodes.
    pub fn add_edge(&mut self, from: String, to: String, label: String) {
        self.edges.push(Edge { from, to, label });
    }

    /// Get a node by id. Returns None if not found.
    pub fn get_node(&self, id: &str) -> Option<&Node> {
        self.nodes.get(id)
    }

    /// Get a mutable reference to a node by id.
    pub fn get_node_mut(&mut self, id: &str) -> Option<&mut Node> {
        self.nodes.get_mut(id)
    }

    /// Query all edges originating from a given node id.
    pub fn query_edges(&self, from: &str) -> Vec<&Edge> {
        self.edges.iter().filter(|e| e.from == from).collect()
    }

    /// Query all edges targeting a given node id.
    pub fn query_incoming_edges(&self, to: &str) -> Vec<&Edge> {
        self.edges.iter().filter(|e| e.to == to).collect()
    }

    /// Save the entire graph to a JSON file.
    pub fn save_to_file(&self, path: &std::path::Path) -> Result<()> {
        let content = serde_json::to_string_pretty(self)
            .context("Serializing knowledge graph")?;
        std::fs::write(path, content)
            .with_context(|| format!("Writing graph to {:?}", path))?;
        info!("Saved knowledge graph to {:?} ({} nodes, {} edges)", path, self.nodes.len(), self.edges.len());
        Ok(())
    }

    /// Load a graph from a JSON file.
    pub fn load_from_file(path: &std::path::Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Reading graph from {:?}", path))?;
        let graph: Self = serde_json::from_str(&content)
            .context("Parsing knowledge graph JSON")?;
        debug!("Loaded knowledge graph from {:?} ({} nodes, {} edges)", path, graph.nodes.len(), graph.edges.len());
        Ok(graph)
    }
}

impl Default for KnowledgeGraph {
    fn default() -> Self {
        Self::new()
    }
}
