const { MiroFishBridge } = require('./mirofish-bridge');
const bridge = new MiroFishBridge();

async function main() {
  console.log('=== MiroFish Bridge Health Check ===');
  const health = await bridge.healthCheck();
  console.log(JSON.stringify(health, null, 2));
  
  if (health.repoExists && health.backendExists && health.pythonAvailable) {
    console.log('\n=== Running test prediction ===');
    const result = await bridge.predict({
      problem: 'Should KClaw0 build a custom planning engine or use an existing tool?',
      seedText: 'KClaw0 is a self-upgrading agent with 14 scripts and 317 tests.',
      maxRounds: 3
    });
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\nHealth check failed - cannot run prediction');
    process.exit(1);
  }
}

main().catch(console.error);
