#!/usr/bin/env python3
"""Minimal MiroFish wrapper for KClaw0 bridge."""
import sys
import json
import os
import argparse

sys.path.insert(0, os.environ.get('PYTHONPATH', ''))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sim-id', required=True)
    parser.add_argument('--problem', required=True)
    parser.add_argument('--seed-path', required=True)
    parser.add_argument('--max-rounds', type=int, default=20)
    parser.add_argument('--backend-dir', required=True)
    args = parser.parse_args()

    # Build simplified prediction without full social simulation
    # Uses MiroFish's config generator + report agent directly
    try:
        from app.services.simulation_config_generator import SimulationConfigGenerator
        from app.services.ontology_generator import OntologyGenerator
        from app.utils.llm_client import LLMClient

        # Generate ontology from problem description
        ontology_gen = OntologyGenerator()
        ontology = ontology_gen.generate_ontology(args.problem)

        # Generate simulation config
        config_gen = SimulationConfigGenerator()
        sim_config = config_gen.generate_config(
            seed_text=args.problem,
            ontology=ontology,
            time_config={"total_simulation_hours": 24, "minutes_per_round": 30}
        )

        # Save config
        sim_dir = os.path.join(args.backend_dir, 'uploads', 'simulations', args.sim_id)
        os.makedirs(sim_dir, exist_ok=True)
        config_path = os.path.join(sim_dir, 'simulation_config.json')
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(sim_config, f, ensure_ascii=False, indent=2)

        # Generate prediction report using ReportAgent
        from app.services.report_agent import ReportAgent
        
        report_agent = ReportAgent(report_id=f"report_{args.sim_id}")
        report = report_agent.generate_report_sync(
            simulation_id=args.sim_id,
            graph_data=ontology,
            requirement=args.problem
        )

        result = {
            "status": "completed",
            "report": report.get("content", ""),
            "recommendedPath": report.get("recommended_path", "N/A"),
            "confidence": report.get("confidence", 0.5),
            "configPath": config_path
        }

    except Exception as e:
        # Fallback: return structured error with what we know
        result = {
            "status": "error",
            "error": str(e),
            "report": f"Prediction failed: {e}",
            "recommendedPath": None,
            "confidence": 0,
            "raw": str(e)
        }

    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
