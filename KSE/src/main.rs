use kse::memory::{MemoryEngine, MemoryConfig, SerializationFormat, KnowledgeGraph};
use std::path::PathBuf;

#[tokio::main]
async fn main() {
    // Set up tracing for readable logs
    tracing_subscriber::fmt::init();

    let config = MemoryConfig {
        data_dir: PathBuf::from("data"),
        format: SerializationFormat::Json,
        auto_save: false,
        auto_save_interval_sec: 60,
    };

    let engine = MemoryEngine::new(config).expect("Failed to create MemoryEngine");

    let test_value = serde_json::json!({
        "agent": "KClaw0",
        "version": "0.1.0",
        "message": "Memory engine initialized successfully!"
    });

    engine.save("boot", test_value.clone()).expect("Failed to save");
    let loaded = engine.load("boot").expect("Failed to load");

    // Demo knowledge graph
    let mut graph = KnowledgeGraph::new();
    graph.add_node(
        "kse".to_string(),
        "system".to_string(),
        serde_json::json!({"name": "KSE", "purpose": "self-upgrade"}),
    );
    graph.add_node(
        "memory_engine".to_string(),
        "component".to_string(),
        serde_json::json!({"name": "Memory Engine", "status": "active"}),
    );
    graph.add_edge(
        "kse".to_string(),
        "memory_engine".to_string(),
        "contains".to_string(),
    );

    let graph_path = PathBuf::from("data/demo_graph.json");
    graph.save_to_file(&graph_path).expect("Failed to save graph");
    let loaded_graph = KnowledgeGraph::load_from_file(&graph_path).expect("Failed to load graph");

    println!("\n╔═══════════════════════════════════════╗");
    println!("║     KSE Memory Engine Demo            ║");
    println!("╠═══════════════════════════════════════╣");
    println!("║ Saved key: 'boot'                     ║");
    println!("║ Loaded value: {}     ║", loaded.get("message").and_then(|v| v.as_str()).unwrap_or("?"));
    println!("║ All keys: {:<27} ║", format!("{:?}", engine.list()));
    println!("║ Graph nodes: {:<24} ║", format!("{}", loaded_graph.nodes.len()));
    println!("║ Graph edges: {:<24} ║", format!("{}", loaded_graph.edges.len()));
    println!("╚═══════════════════════════════════════╝");
    println!("\nStatus: Memory engine operational ✓");
}