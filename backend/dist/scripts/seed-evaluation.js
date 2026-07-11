"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const prisma = new client_1.PrismaClient();
function runPython(scriptName) {
    return new Promise((resolve, reject) => {
        const pythonExe = 'python';
        const scriptPath = path_1.default.join(__dirname, '..', '..', '..', 'ai-service', scriptName);
        const command = `${pythonExe} "${scriptPath}"`;
        (0, child_process_1.exec)(command, (error, stdout, stderr) => {
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
            }
            catch (err) {
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
                path: path_1.default.join(__dirname, '..', '..', '..', 'ai-service', 'models'),
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
    }
    catch (err) {
        console.error('Failed to seed evaluation metrics:', err.message);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
