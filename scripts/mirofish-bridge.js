const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * MiroFish Bridge for KClaw0
 * 
 * Wraps MiroFish's prediction engine so KClaw0 can:
 * 1. Seed a scenario (problem description + constraints)
 * 2. Trigger multi-agent simulation
 * 3. Receive prediction report with recommended path
 * 
 * MiroFish location: /root/.openclaw/workspace/mirofish
 */

const MIROFISH_DIR = '/root/.openclaw/workspace/mirofish';
const BACKEND_DIR = path.join(MIROFISH_DIR, 'backend');
const SIMULATIONS_DIR = path.join(BACKEND_DIR, 'uploads', 'simulations');

class MiroFishBridge {
  constructor() {
    this.simulationsDir = SIMULATIONS_DIR;
    this.backendDir = BACKEND_DIR;
  }

  /**
   * Run a prediction simulation for a given problem
   * @param {Object} params
   * @param {string} params.problem - Problem description (natural language)
   * @param {string} params.seedText - Supporting context/docs (optional)
   * @param {number} params.maxRounds - Simulation rounds (default: 20)
   * @param {string} params.simulationId - Optional custom ID
   * @returns {Promise<Object>} Prediction report
   */
  async predict({ problem, seedText = '', maxRounds = 20, simulationId = null }) {
    const simId = simulationId || `kclaw_${Date.now()}`;
    
    // Step 1: Write seed material
    const seedPath = path.join(this.simulationsDir, simId, 'seed.txt');
    fs.mkdirSync(path.dirname(seedPath), { recursive: true });
    fs.writeFileSync(seedPath, `PROBLEM: ${problem}\n\nCONTEXT:\n${seedText}`, 'utf-8');

    // Step 2: Run MiroFish pipeline via Python wrapper
    const result = await this._runPythonPipeline({
      simId,
      problem,
      seedPath,
      maxRounds
    });

    return {
      simulationId: simId,
      status: result.status,
      report: result.report,
      recommendedPath: result.recommendedPath,
      confidence: result.confidence,
      rawOutput: result.raw
    };
  }

  /**
   * Internal: Spawn Python process to run MiroFish services
   */
  _runPythonPipeline({ simId, problem, seedPath, maxRounds }) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, 'mirofish_wrapper.py');
      
      // Ensure wrapper exists
      if (!fs.existsSync(pythonScript)) {
        this._ensureWrapper(pythonScript);
      }

      const args = [
        pythonScript,
        '--sim-id', simId,
        '--problem', problem,
        '--seed-path', seedPath,
        '--max-rounds', String(maxRounds),
        '--backend-dir', this.backendDir
      ];

      const proc = spawn('python3', args, {
        cwd: this.backendDir,
        env: {
          ...process.env,
          PYTHONPATH: this.backendDir,
          PYTHONUTF8: '1'
        }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`MiroFish pipeline failed (exit ${code}): ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout.split('\n').filter(l => l.trim()).pop());
          resolve(result);
        } catch (e) {
          resolve({
            status: 'unknown',
            report: stdout,
            recommendedPath: null,
            confidence: 0,
            raw: stdout
          });
        }
      });
    });
  }

  /**
   * Ensure Python wrapper script exists
   */
  _ensureWrapper(wrapperPath) {
    const wrapperContent = `#!/usr/bin/env python3
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
`;
    fs.writeFileSync(wrapperPath, wrapperContent, 'utf-8');
  }

  /**
   * Quick check: Is MiroFish installed and reachable?
   */
  healthCheck() {
    return new Promise((resolve) => {
      const checks = {
        repoExists: fs.existsSync(MIROFISH_DIR),
        backendExists: fs.existsSync(BACKEND_DIR),
        servicesExist: fs.existsSync(path.join(BACKEND_DIR, 'app', 'services')),
        pythonAvailable: false
      };

      exec('python3 -c "import sys; print(sys.version)"', (err) => {
        checks.pythonAvailable = !err;
        resolve(checks);
      });
    });
  }
}

module.exports = { MiroFishBridge };

// CLI usage
if (require.main === module) {
  const bridge = new MiroFishBridge();
  
  if (process.argv.includes('--health-check')) {
    bridge.healthCheck().then(console.log);
  } else if (process.argv.includes('--predict')) {
    const problemIdx = process.argv.indexOf('--predict') + 1;
    const problem = process.argv[problemIdx] || 'Test prediction scenario';
    bridge.predict({ problem, maxRounds: 5 }).then(console.log).catch(console.error);
  } else {
    console.log('Usage: node mirofish-bridge.js --health-check');
    console.log('       node mirofish-bridge.js --predict "Your problem description"');
  }
}
