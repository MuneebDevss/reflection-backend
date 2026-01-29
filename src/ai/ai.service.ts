import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DateTimeService } from '../common/date-time/date-time.service';

export interface GeneratedQuestion {
  question: string;
  options: string[];
  order: number;
}

export interface AIQuestionsResponse {
  questions: GeneratedQuestion[];
}

export interface GoalSummary {
  title: string;
  description: string | null;
  deadline: Date;
  progress: number;
}

export interface PreviousTask {
  title: string;
  description: string | null;
  date: Date;
  difficulty: number;
  status: string;
}

export interface GeneratedTask {
  title: string;
  description: string | null;
  difficulty: number;
}

export interface AITasksResponse {
  tasks: GeneratedTask[];
}

export type AdaptiveStrategy = 
  | 'PROGRESSIVE' 
  | 'BALANCED' 
  | 'RECOVERY' 
  | 'RESET' 
  | 'INTERVENTION';

export interface AdaptivePlan {
  finalTaskCount: number;
  finalDifficulty: number;
  carryOverRatio: number; // 0 to 1, percentage of tasks that should be adapted from missed tasks
  strategyName: AdaptiveStrategy;
  completionRatio: number;
  consecutiveMissedDays: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor(private dateTimeService: DateTimeService) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not found. AI features will be disabled.');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }
  }

  async generateGoalQuestions(rawGoalText: string): Promise<GeneratedQuestion[]> {
    try {
        
      if (!process.env.GEMINI_API_KEY || !this.model) {
        this.logger.warn('Using fallback questions - Gemini API key not configured');
        return this.getFallbackQuestions(rawGoalText);
      }

      const prompt = `You are an AI assistant helping users clarify their goals.
Given a user's initial goal description, generate 5-7 clarification questions to help them define a clear, actionable goal.

Requirements for each question:
- Short and simple (1-2 sentences)
- Focus on ONE specific concept
- Provide 3-6 concrete answer options
- Questions should cover: area of focus, time commitment, pace/intensity, deadline, motivation, success metrics, and obstacles

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "questions": [
    {
      "question": "What area would you like to focus on?",
      "options": ["Health & Fitness", "Learning & Growth", "Career", "Relationships"],
      "order": 1
    }
  ]
}

Now generate clarification questions for this goal: "${rawGoalText}"`;

      this.logger.log(`Generating questions for goal: ${rawGoalText}`);

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      let responseText = response.text().trim();

      if (!responseText) {
        throw new Error('Empty response from Gemini');
      }

      this.logger.debug(`Gemini response: ${responseText}`);

      // Remove markdown code blocks if present
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      // Parse JSON response
      const parsed = JSON.parse(responseText) as AIQuestionsResponse;

      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid response format from AI');
      }

      // Validate and sanitize questions
      const questions = parsed.questions
        .filter(q => q.question && q.options && Array.isArray(q.options))
        .map((q, index) => ({
          question: q.question.trim(),
          options: q.options.map(opt => opt.trim()).filter(opt => opt.length > 0),
          order: q.order || index + 1,
        }))
        .filter(q => q.options.length >= 2);

      if (questions.length === 0) {
        this.logger.warn('No valid questions generated, using fallback');
        return this.getFallbackQuestions(rawGoalText);
      }

      this.logger.log(`Successfully generated ${questions.length} questions`);
      return questions;

    } catch (error) {
      this.logger.error(`Failed to generate questions: ${error.message}`, error.stack);
      
      // Return fallback questions instead of throwing
      this.logger.warn('Using fallback questions due to AI error');
      return this.getFallbackQuestions(rawGoalText);
    }
  }

  private getFallbackQuestions(rawGoalText: string): GeneratedQuestion[] {
    return [
      {
        question: "What area of your life does this goal focus on?",
        options: ["Health & Fitness", "Learning & Growth", "Career", "Relationships", "Creativity", "Mindfulness"],
        order: 1,
      },
      {
        question: "How much time can you dedicate to this goal each day?",
        options: ["15 minutes", "30 minutes", "1 hour", "2+ hours"],
        order: 2,
      },
      {
        question: "What pace would you prefer for this goal?",
        options: ["Gentle & steady", "Moderate push", "Ambitious challenge"],
        order: 3,
      },
      {
        question: "When would you like to achieve this goal?",
        options: ["1 month", "3 months", "6 months", "1 year"],
        order: 4,
      },
      {
        question: "What motivates you most about this goal?",
        options: ["Personal growth", "Proving myself", "Inspiring others", "Building habits", "Overcoming challenges"],
        order: 5,
      },
    ];
  }

  async generateGoalSummary(rawGoalText: string, answers: { question: string; answer: string }[]): Promise<{ title: string; description: string; deadline: Date }> {
    try {
      if (!process.env.GEMINI_API_KEY || !this.model) {
        this.logger.warn('Using fallback goal summary - Gemini API key not configured');
        return this.getFallbackGoalSummary(rawGoalText, answers);
      }

      const answersText = answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
      const prompt = `You are an AI assistant helping users create clear, actionable goals.

Based on the user's initial goal and their answers to clarification questions, generate:
1. A clear, concise goal title (5-10 words)
2. A comprehensive description of the goal. This must synthesize the initial goal with all the details, constraints, and preferences provided in the user's answers. It should serve as a detailed project brief that contains enough context to generate specific sub-tasks later.
3. A realistic deadline date

Initial goal: "${rawGoalText}"

Answers:
${answersText}

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "title": "Learn conversational Spanish",
  "description": "Achieve basic conversational fluency in Spanish to communicate confidently in everyday situations and travel contexts.",
  "deadlineInDays": 90
}

The title should be action-oriented and specific. The description should provide context about the goal. The deadlineInDays should be a number representing days from today.`;

      this.logger.log(`Generating goal summary from ${answers.length} answers`);

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      let responseText = response.text().trim();

      if (!responseText) {
        throw new Error('Empty response from Gemini');
      }

      this.logger.debug(`Gemini goal summary response: ${responseText}`);

      // Remove markdown code blocks if present
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      // Parse JSON response
      const parsed = JSON.parse(responseText) as { title: string; description: string; deadlineInDays: number };

      if (!parsed.title || typeof parsed.deadlineInDays !== 'number') {
        throw new Error('Invalid response format from AI');
      }

      // Calculate deadline date
      const normalizedToday = this.dateTimeService.normalizeToUTCMidnight();
      const deadline = this.dateTimeService.addDays(
        Math.max(1, Math.min(365, parsed.deadlineInDays)),
        normalizedToday
      );

      this.logger.log(`Generated goal summary: "${parsed.title}" with deadline in ${parsed.deadlineInDays} days`);

      return {
        title: parsed.title.trim(),
        description: parsed.description?.trim() || '',
        deadline,
      };

    } catch (error) {
      this.logger.error(`Failed to generate goal summary: ${error.message}`, error.stack);
      this.logger.warn('Using fallback goal summary due to AI error');
      return this.getFallbackGoalSummary(rawGoalText, answers);
    }
  }

  private getFallbackGoalSummary(rawGoalText: string, answers: { question: string; answer: string }[]): { title: string; description: string; deadline: Date } {
    // Extract deadline from answers if available
    const deadlineAnswer = answers.find(a => 
      a.question.toLowerCase().includes('when') || 
      a.question.toLowerCase().includes('deadline')
    );

    let deadlineInDays = 90; // Default 3 months

    if (deadlineAnswer) {
      const answer = deadlineAnswer.answer.toLowerCase();
      if (answer.includes('1 month')) deadlineInDays = 30;
      else if (answer.includes('3 month')) deadlineInDays = 90;
      else if (answer.includes('6 month')) deadlineInDays = 180;
      else if (answer.includes('1 year')) deadlineInDays = 365;
    }

    const deadline = this.dateTimeService.addDays(deadlineInDays);

    // Create a simple title from raw goal text (truncate if too long)
    const title = rawGoalText.length > 50 
      ? rawGoalText.substring(0, 47) + '...'
      : rawGoalText;

    // Create a description from the raw goal text and answers
    const description = `Goal to ${rawGoalText.toLowerCase()}. Based on your preferences and timeline.`;

    return { title, description, deadline };
  }

  /**
   * Calculate adaptive task generation plan based on previous task performance.
   * 
   * This function analyzes recent task history to determine:
   * - How many tasks to generate
   * - What difficulty level to use
   * - What ratio of tasks should be adapted from missed tasks vs new tasks
   * - Which strategy to apply
   * 
   * Strategy selection logic:
   * - PROGRESSIVE: 80%+ completion → increase difficulty and count, all new tasks
   * - BALANCED: 50-80% completion → maintain current level, mostly new tasks
   * - RECOVERY: 20-50% completion → decrease difficulty, half adapted tasks
   * - RESET: <20% completion → decrease difficulty and count, mostly adapted tasks
   * - INTERVENTION: 3+ consecutive missed days → minimal tasks, habit-building focus
   * 
   * @param previousTasks - Array of recent previous tasks (max 7-10 recommended)
   * @param daysUntilDeadline - Number of days remaining until goal deadline
   * @returns AdaptivePlan with calculated parameters
   */
  private calculateAdaptivePlan(
    previousTasks: PreviousTask[],
    daysUntilDeadline: number,
  ): AdaptivePlan {
    // Default starting values
    const DEFAULT_TASK_COUNT = 3;
    const DEFAULT_DIFFICULTY = 2;
    const MIN_TASK_COUNT = 1;
    const MAX_TASK_COUNT = 6;
    const MIN_DIFFICULTY = 1;
    const MAX_DIFFICULTY = 5;

    // If no previous tasks, use defaults with BALANCED strategy
    if (!previousTasks || previousTasks.length === 0) {
      return {
        finalTaskCount: DEFAULT_TASK_COUNT,
        finalDifficulty: DEFAULT_DIFFICULTY,
        carryOverRatio: 0,
        strategyName: 'BALANCED',
        completionRatio: 0,
        consecutiveMissedDays: 0,
      };
    }
    
    // Filter tasks from the last 3 days for recent performance analysis
    const THREE_DAYS_AGO = this.dateTimeService.addDays(
    -3,this.dateTimeService.getCurrentDate()
    );

    const recentTasks = previousTasks.filter(
    t => t.date >= THREE_DAYS_AGO
    );

    
    // Calculate completion ratio
    const completedCount = recentTasks.filter(t => t.status === 'COMPLETED').length;
    const totalTasks = recentTasks.length;
    const completionRatio = totalTasks > 0 ? completedCount / totalTasks : 0;

    // Detect consecutive missed days
    // Group tasks by date and check if entire days were missed
    const tasksByDate = new Map<string, PreviousTask[]>();
    recentTasks.forEach(task => {
      const dateKey = task.date.toISOString().split('T')[0];
      if (!tasksByDate.has(dateKey)) {
        tasksByDate.set(dateKey, []);
      }
      tasksByDate.get(dateKey)!.push(task);
    });
    

    let consecutiveMissedDays = 0;
    const sortedDays = Array.from(tasksByDate.entries())
  .sort(([a], [b]) => b.localeCompare(a));

    for (const [, dayTasks] of sortedDays) {
      const allMissed = dayTasks.every(t => t.status !== 'COMPLETED');
      if (allMissed) {
        consecutiveMissedDays++;
      } else {
        break; // Stop counting when we hit a day with completions
      }
    }

    // Calculate average difficulty and task count from recent history
    const avgDifficulty = recentTasks.reduce((sum, t) => sum + t.difficulty, 0) / recentTasks.length;
    const avgTaskCount = tasksByDate.size > 0 
      ? Array.from(tasksByDate.values()).reduce((sum, tasks) => sum + tasks.length, 0) / tasksByDate.size
      : DEFAULT_TASK_COUNT;

    let finalTaskCount: number;
    let finalDifficulty: number;
    let carryOverRatio: number;
    let strategyName: AdaptiveStrategy;

    // INTERVENTION MODE: 3+ consecutive missed days
    if (consecutiveMissedDays >= 3) {
      strategyName = 'INTERVENTION';
      finalDifficulty = Math.max(MIN_DIFFICULTY, Math.floor(avgDifficulty) - 1);
      finalTaskCount = Math.max(MIN_TASK_COUNT, Math.floor(avgTaskCount) - 1);
      carryOverRatio = 0.8; // 80% adapted tasks - focus on very small habit-building tasks
      
      this.logger.log(`INTERVENTION mode triggered: ${consecutiveMissedDays} consecutive missed days`);
    }
    // PROGRESSIVE: 80%+ completion
    else if (completionRatio >= 0.8) {
      const urgencyMultiplier =
      daysUntilDeadline <= 7 ? 1.2 :
      daysUntilDeadline <= 30 ? 1.1 :
      1;

      strategyName = 'PROGRESSIVE';
      finalDifficulty = Math.min(MAX_DIFFICULTY, Math.ceil(avgDifficulty) + 1);
      finalTaskCount = Math.min(MAX_TASK_COUNT, Math.ceil(avgTaskCount * urgencyMultiplier) + 1);
      carryOverRatio = 0; // All new tasks
      
      this.logger.log(`PROGRESSIVE mode: ${(completionRatio * 100).toFixed(0)}% completion`);
    }
    // BALANCED: 50-80% completion
    else if (completionRatio >= 0.5) {
      strategyName = 'BALANCED';
      finalDifficulty = Math.round(avgDifficulty);
      finalTaskCount = Math.round(avgTaskCount);
      carryOverRatio = 0.2; // 20% adapted tasks
      
      this.logger.log(`BALANCED mode: ${(completionRatio * 100).toFixed(0)}% completion`);
    }
    // RECOVERY: 20-50% completion
    else if (completionRatio >= 0.2) {
      strategyName = 'RECOVERY';
      finalDifficulty = Math.max(MIN_DIFFICULTY, Math.floor(avgDifficulty) - 1);
      finalTaskCount = Math.max(MIN_TASK_COUNT, Math.floor(avgTaskCount));
      carryOverRatio = 0.5; // 50% adapted tasks
      
      this.logger.log(`RECOVERY mode: ${(completionRatio * 100).toFixed(0)}% completion`);
    }
    // RESET: <20% completion
    else {
      strategyName = 'RESET';
      finalDifficulty = Math.max(MIN_DIFFICULTY, Math.floor(avgDifficulty) - 1);
      finalTaskCount = Math.max(MIN_TASK_COUNT, Math.floor(avgTaskCount) - 1);
      carryOverRatio = 0.7; // 70% adapted tasks
      
      this.logger.log(`RESET mode: ${(completionRatio * 100).toFixed(0)}% completion`);
    }

    // Ensure values are within bounds
    finalTaskCount = Math.max(MIN_TASK_COUNT, Math.min(MAX_TASK_COUNT, finalTaskCount));
    finalDifficulty = Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, finalDifficulty));
    carryOverRatio = Math.max(0, Math.min(1, carryOverRatio));

    this.logger.log(
      `Adaptive plan: ${strategyName} - ${finalTaskCount} tasks at difficulty ${finalDifficulty} ` +
      `(${(carryOverRatio * 100).toFixed(0)}% adapted from missed tasks)`
    );

    return {
      finalTaskCount,
      finalDifficulty,
      carryOverRatio,
      strategyName,
      completionRatio,
      consecutiveMissedDays,
    };
  }

  /**
   * Generate tasks using AI based on goal summary and previous task performance
   */
  async generateTasks(
    goalSummary: GoalSummary,
    previousTasks: PreviousTask[],
    count: number,
    difficulty: number
  ): Promise<GeneratedTask[]> {
    try {
      if (!process.env.GEMINI_API_KEY || !this.model) {
        this.logger.warn('Using fallback tasks - Gemini API key not configured');
        return this.getFallbackTasks(count, difficulty);
      }

      const daysUntilDeadline = this.dateTimeService.getDaysDifference(
        this.dateTimeService.getCurrentDate(),
        goalSummary.deadline
      );

      // Calculate adaptive plan based on previous task performance
      const adaptivePlan = this.calculateAdaptivePlan(previousTasks, daysUntilDeadline);
      
      // Use adaptive values instead of passed parameters
      const finalCount = adaptivePlan.finalTaskCount;
      const finalDifficulty = adaptivePlan.finalDifficulty;
      
      // Prepare context about previous tasks for AI prompt
      const recentTasksContext = previousTasks.slice(0, 10).map((task, idx) => 
        `Day ${idx + 1}: "${task.title}" (Difficulty: ${task.difficulty}, Status: ${task.status})`
      ).join('\n');
      
      // Get missed tasks for potential adaptation
      const missedTasks = previousTasks.filter(t => 
        t.status === 'PENDING' || t.status === 'SKIPPED'
      ).slice(0, 5); // Get up to 5 recent missed tasks
      
      const missedTasksContext = missedTasks.length > 0
        ? missedTasks.map(t => `"${t.title}" (Difficulty: ${t.difficulty})`).join('\n')
        : 'None';
      
      // Calculate how many tasks should be adapted vs new
      const adaptedTaskCount = Math.round(finalCount * adaptivePlan.carryOverRatio);
      const newTaskCount = finalCount - adaptedTaskCount;
      
      // Build strategy explanation for AI
      let strategyExplanation = '';
      switch (adaptivePlan.strategyName) {
        case 'PROGRESSIVE':
          strategyExplanation = 'The user is performing excellently (80%+ completion rate). Generate ALL NEW challenging tasks to progressively increase difficulty and maintain momentum.';
          break;
        case 'BALANCED':
          strategyExplanation = 'The user is making good progress (50-80% completion rate). Generate mostly new tasks with a small portion inspired by missed tasks (but simplified).';
          break;
        case 'RECOVERY':
          strategyExplanation = 'The user is struggling (20-50% completion rate). Generate half new tasks and half ADAPTED tasks from missed work. Adapted tasks must be EASIER, SMALLER in scope, and SHORTER in duration than the original.';
          break;
        case 'RESET':
          strategyExplanation = 'The user needs support (<20% completion rate). Generate mostly ADAPTED tasks from missed work (70%), making them significantly easier and more achievable. Focus on rebuilding confidence.';
          break;
        case 'INTERVENTION':
          strategyExplanation = `The user has missed ${adaptivePlan.consecutiveMissedDays} consecutive days. Generate VERY SMALL habit-building tasks (80% adapted from missed work). Tasks should take 5-10 minutes maximum and focus on getting back into the routine.`;
          break;
      }

      const prompt = `You are an AI assistant helping users achieve their goals through daily tasks.

Goal Information:
- Title: ${goalSummary.title}
- Description: ${goalSummary.description || 'No description provided'}
- Deadline: ${daysUntilDeadline} days from now
- Current Progress: ${goalSummary.progress}%

Recent Task History:
${recentTasksContext || 'No previous tasks yet'}

Previously Missed/Skipped Tasks:
${missedTasksContext}

📊 ADAPTIVE STRATEGY: ${adaptivePlan.strategyName}
Completion Rate: ${(adaptivePlan.completionRatio * 100).toFixed(0)}%
${strategyExplanation}

Task Generation Requirements:
- Generate EXACTLY ${finalCount} tasks for today
- Target difficulty level: ${finalDifficulty} (on a scale of 1-5)
- Task composition:
  * ${newTaskCount} NEW tasks (fresh activities)
  * ${adaptedTaskCount} ADAPTED tasks (from missed work, but simplified)

⚠️ CRITICAL: When adapting missed tasks:
- NEVER repeat the exact same task title
- Make adapted tasks EASIER than the original
- Reduce scope (e.g., "Complete chapter 3" → "Read 5 pages from chapter 3")
- Shorten duration (e.g., "60 minute session" → "15 minute session")
- Lower complexity (e.g., "Write full essay" → "Outline main points")
- Adapted tasks can be difficulty ${Math.max(1, finalDifficulty - 1)} even if target is ${finalDifficulty}

Difficulty Guidelines:
- Level 1 (Easy): Small, simple actions (5-15 min)
- Level 2 (Medium): Regular tasks (15-30 min)
- Level 3 (Hard): Focused work (30-60 min)
- Level 4 (Very Hard): Challenging tasks (1-2 hours)
- Level 5 (Challenging): Major milestones (2+ hours)

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "tasks": [
    {
      "title": "Practice basic Spanish greetings for 10 minutes",
      "description": "Adapted from previous missed task - simplified to just greetings",
      "difficulty": ${finalDifficulty}
    }
  ]
}

Generate ${finalCount} unique, actionable tasks for today:`;

      this.logger.log(`Generating ${finalCount} tasks at difficulty ${finalDifficulty} using ${adaptivePlan.strategyName}`);

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      let responseText = response.text().trim();

      if (!responseText) {
        throw new Error('Empty response from Gemini');
      }

      this.logger.debug(`Gemini tasks response: ${responseText.substring(0, 200)}...`);

      // Remove markdown code blocks if present
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      // Parse JSON response
      const parsed = JSON.parse(responseText) as AITasksResponse;

      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        throw new Error('Invalid response format from AI');
      }

      // Validate and sanitize tasks
      const tasks = parsed.tasks
        .filter(t => t.title && t.title.trim().length > 0)
        .map(t => ({
          title: t.title.trim(),
          description: t.description?.trim() || null,
          // Allow AI to set difficulty, but clamp to reasonable range around target
          difficulty: Math.max(1, Math.min(5, t.difficulty || finalDifficulty)),
        }))
        .slice(0, finalCount); // Ensure we don't exceed requested count

      if (tasks.length === 0) {
        this.logger.warn('No valid tasks generated, using fallback');
        return this.getFallbackTasks(finalCount, finalDifficulty);
      }

      // If we got fewer tasks than requested, fill with fallback tasks
      if (tasks.length < finalCount) {
        this.logger.warn(`Generated only ${tasks.length} tasks, filling with ${finalCount - tasks.length} fallback tasks`);
        const fallbackTasks = this.getFallbackTasks(finalCount - tasks.length, finalDifficulty);
        tasks.push(...fallbackTasks);
      }

      this.logger.log(`Successfully generated ${tasks.length} tasks using ${adaptivePlan.strategyName} strategy`);
      return tasks;

    } catch (error) {
      this.logger.error(`Failed to generate tasks: ${error.message}`, error.stack);
      this.logger.warn('Using fallback tasks due to AI error');
      return this.getFallbackTasks(count, difficulty);
    }
  }

  /**
   * Generate fallback tasks when AI is unavailable
   */
  private getFallbackTasks(count: number, difficulty: number): GeneratedTask[] {
    const templates = {
      1: [
        { title: 'Take a small step towards your goal', description: 'Spend 5-10 minutes on a simple task' },
        { title: 'Review your goal and plan', description: 'Reflect on your progress and next steps' },
        { title: 'Do a quick practice session', description: 'Focus on one aspect for 10 minutes' },
      ],
      2: [
        { title: 'Complete a focused work session', description: 'Dedicate 20-30 minutes to your goal' },
        { title: 'Practice key skills', description: 'Work on fundamental techniques' },
        { title: 'Review and apply learnings', description: 'Apply what you\'ve learned recently' },
      ],
      3: [
        { title: 'Deep work session', description: 'Spend 45-60 minutes on focused work' },
        { title: 'Tackle a challenging aspect', description: 'Work on something that pushes you' },
        { title: 'Complete a significant milestone', description: 'Make substantial progress today' },
      ],
      4: [
        { title: 'Extended practice session', description: 'Dedicate 1-2 hours to intensive work' },
        { title: 'Challenge yourself significantly', description: 'Push beyond your comfort zone' },
        { title: 'Work on advanced techniques', description: 'Focus on complex aspects of your goal' },
      ],
      5: [
        { title: 'Major milestone work', description: 'Dedicate 2+ hours to a significant achievement' },
        { title: 'Complete a major project component', description: 'Finish an important part of your goal' },
        { title: 'Intensive focus session', description: 'Deep, uninterrupted work on your goal' },
      ],
    };

    const difficultyKey = Math.max(1, Math.min(5, difficulty)) as keyof typeof templates;
    const taskTemplates = templates[difficultyKey];

    const tasks: GeneratedTask[] = [];
    for (let i = 0; i < count; i++) {
      const template = taskTemplates[i % taskTemplates.length];
      tasks.push({
        title: `${template.title} ${i > 2 ? `(${i + 1})` : ''}`.trim(),
        description: template.description,
        difficulty: difficulty,
      });
    }

    return tasks;
  }
}
