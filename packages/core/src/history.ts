import fs from 'node:fs';
import path from 'node:path';
import { EvaluationRun } from './types.js';

export interface RunSummary {
  id: string;
  timestamp: string;
  projectName: string;
  evaluationName: string;
  targetName: string;
  modelName?: string;
  overallScore: number;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  avgLatencyMs: number;
  totalCost: number;
  filePath: string;
}

export class HistoryManager {
  private runsDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.runsDir = path.join(baseDir, '.eval', 'runs');
    if (!fs.existsSync(this.runsDir)) {
      try {
        fs.mkdirSync(this.runsDir, { recursive: true });
      } catch {
        // Directory creation error
      }
    }
  }

  saveRun(run: EvaluationRun): string {
    if (!fs.existsSync(this.runsDir)) {
      fs.mkdirSync(this.runsDir, { recursive: true });
    }
    const safeId = run.id.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filePath = path.join(this.runsDir, `${safeId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(run, null, 2), 'utf8');
    return filePath;
  }

  listRuns(): RunSummary[] {
    if (!fs.existsSync(this.runsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.runsDir).filter((f) => f.endsWith('.json'));
    const summaries: RunSummary[] = [];

    for (const file of files) {
      const filePath = path.join(this.runsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const run: EvaluationRun = JSON.parse(content);
        summaries.push({
          id: run.id,
          timestamp: run.timestamp,
          projectName: run.projectName,
          evaluationName: run.evaluationName,
          targetName: run.targetName,
          modelName: run.modelName,
          overallScore: run.overallScore,
          totalCases: run.totalCases,
          passedCases: run.passedCases,
          failedCases: run.failedCases,
          avgLatencyMs: run.latencyStats.avgMs,
          totalCost: run.totalCost,
          filePath,
        });
      } catch {
        // Skip unreadable files
      }
    }

    // Sort descending by timestamp
    return summaries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getRun(id: string): EvaluationRun | null {
    if (id === 'latest') {
      const runs = this.listRuns();
      if (runs.length === 0) return null;
      return this.getRun(runs[0]!.id);
    }

    const safeId = id.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filePath = path.join(this.runsDir, `${safeId}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content) as EvaluationRun;
    } catch {
      return null;
    }
  }

  deleteRun(id: string): boolean {
    const safeId = id.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filePath = path.join(this.runsDir, `${safeId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}
