import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import path from 'path';

const prisma = new PrismaClient();

function runPython(scriptName: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonExe = 'python';
    const scriptPath = path.join(__dirname, '..', '..', '..', 'ai-service', scriptName);
    const command = `${pythonExe} "${scriptPath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || error.message));
      }
      try {
        const lines = stdout.trim().split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith('{') && line.endsWith('}')) {
            return resolve(JSON.parse(line));
          }
        }
        reject(new Error(`No JSON output returned`));
      } catch (err: any) {
        reject(err);
      }
    });
  });
}

async function main() {
  console.log('Running ML model evaluation to seed database...');
  try {
    const report = await runPython('evaluate.py');
    if (!report) {
      throw new Error('No report returned');
    }

    const model_id = 'model-' + Math.random().toString(36).substring(2, 9);
    await prisma.modelVersion.create({
      data: {
        id: model_id,
        modelName: "SafeMesh Hybrid Classifier",
        version: "v1.0.0",
        path: path.join(__dirname, '..', '..', '..', 'ai-service', 'models'),
        trainedAt: new Date(),
        metricsJson: JSON.stringify(report.compound)
      }
    });

    const eval_id = 'eval-' + Math.random().toString(36).substring(2, 9);
    await prisma.evaluationRun.create({
      data: {
        id: eval_id,
        modelId: model_id,
        timestamp: new Date(),
        metricsJson: JSON.stringify(report),
        confusionMatrixJson: JSON.stringify(report.compound.confusion_matrix)
      }
    });

    for (const k of ['accuracy', 'precision', 'recall', 'f1', 'specificity']) {
      const val = report.compound[k];
      await prisma.evaluationMetric.create({
        data: {
          evalRunId: eval_id,
          metricName: `compound_${k}`,
          metricValue: parseFloat(val)
        }
      });
    }

    console.log('Evaluation results successfully seeded into database!');
  } catch (err: any) {
    console.error('Failed to seed evaluation metrics:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
