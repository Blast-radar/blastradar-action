const https = require('https');
const { execSync } = require('child_process');

const apiKey = process.env.ANTHROPIC_API_KEY;
const threshold = parseInt(process.env.INPUT_THRESHOLD || '7');

function getDiff() {
  try {
    return execSync('git diff HEAD~1 HEAD', { encoding: 'utf8' });
  } catch (e) {
    try {
      return execSync('git diff origin/main HEAD', { encoding: 'utf8' });
    } catch (e2) {
      return '';
    }
  }
}

function analyze(diff) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are a senior SRE reviewing a code diff for production risk. Analyze this diff and respond ONLY with a JSON object — no preamble, no markdown, just raw JSON.

The JSON must have exactly this shape:
{
  "score": <integer 1-10>,
  "verdict": "<one sentence>",
  "explanation": "<2-3 sentences: production reliability risks only>",
  "blast_radius": [
    { "system": "<system name>", "severity": "<high|medium|low>", "reason": "<one short phrase>" }
  ]
}

Diff to analyze:
${diff}`
      }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          const text = response.content.map(b => b.text || '').join('');
          const result = JSON.parse(text.replace(/```json|```/g, '').trim());
          resolve(result);
        } catch (e) {
          reject(new Error('Failed to parse response: ' + body));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function setOutput(name, value) {
  console.log(`::set-output name=${name}::${value}`);
}

function notice(msg) {
  console.log(`::notice::${msg}`);
}

function error(msg) {
  console.log(`::error::${msg}`);
}

async function run() {
  console.log('⚡ BlastRadar: Scanning PR for production risk...\n');

  const diff = getDiff();

  if (!diff || diff.trim().length === 0) {
    notice('No diff detected — skipping analysis.');
    process.exit(0);
  }

  try {
    const result = await analyze(diff);
    const score = Math.max(1, Math.min(10, result.score));
    const emoji = score >= 7 ? '🔴' : score >= 4 ? '🟡' : '🟢';

    console.log(`${emoji} Risk Score: ${score}/10`);
    console.log(`\n📋 ${result.verdict}`);
    console.log(`\n⚠️  ${result.explanation}`);

    if (result.blast_radius && result.blast_radius.length > 0) {
      console.log('\n💥 Blast Radius:');
      result.blast_radius.forEach(b => {
        console.log(`   • ${b.system} — ${b.reason}`);
      });
    }

    setOutput('risk-score', score);
    setOutput('verdict', result.verdict);

    console.log('');

    if (score >= threshold) {
      error(`BlastRadar: Risk score ${score}/10 exceeds threshold of ${threshold}/10. Review required.`);
      process.exit(1);
    } else {
      notice(`BlastRadar: Risk score ${score}/10 is within acceptable threshold.`);
      process.exit(0);
    }
  } catch (err) {
    error('BlastRadar analysis failed: ' + err.message);
    process.exit(0);
  }
}

run();
