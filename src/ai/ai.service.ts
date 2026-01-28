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
2. A detailed description of the goal (2-3 sentences explaining what the user wants to achieve)
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

      // Prepare context about previous tasks
      const recentTasksContext = previousTasks.slice(0, 10).map((task, idx) => 
        `Day ${idx + 1}: "${task.title}" (Difficulty: ${task.difficulty}, Status: ${task.status})`
      ).join('\n');

      const daysUntilDeadline = this.dateTimeService.getDaysDifference(
        this.dateTimeService.getCurrentDate(),
        goalSummary.deadline
      );

      const prompt = `You are an AI assistant helping users achieve their goals through daily tasks.

Goal Information:
- Title: ${goalSummary.title}
- Description: ${goalSummary.description || 'No description provided'}
- Deadline: ${daysUntilDeadline} days from now
- Current Progress: ${goalSummary.progress}%

Recent Task History:
${recentTasksContext || 'No previous tasks yet'}

Task Generation Requirements:
- Generate EXACTLY ${count} tasks for today
- Each task should have difficulty level ${difficulty} (on a scale of 1-5)
- Tasks should be:
  * Specific and actionable
  * Aligned with the goal
  * Different from previous tasks (vary the activities)
  * Appropriately challenging for the difficulty level
  * Achievable in one day

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
      "title": "Practice Spanish verb conjugations for 20 minutes",
      "description": "Focus on present tense regular verbs using flashcards or an app",
      "difficulty": ${difficulty}
    }
  ]
}

Generate ${count} unique, actionable tasks for today:`;

      this.logger.log(`Generating ${count} tasks with difficulty ${difficulty} for goal: ${goalSummary.title}`);

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
          difficulty: difficulty, // Ensure consistent difficulty
        }))
        .slice(0, count); // Ensure we don't exceed requested count

      if (tasks.length === 0) {
        this.logger.warn('No valid tasks generated, using fallback');
        return this.getFallbackTasks(count, difficulty);
      }

      // If we got fewer tasks than requested, fill with fallback tasks
      if (tasks.length < count) {
        this.logger.warn(`Generated only ${tasks.length} tasks, filling with ${count - tasks.length} fallback tasks`);
        const fallbackTasks = this.getFallbackTasks(count - tasks.length, difficulty);
        tasks.push(...fallbackTasks);
      }

      this.logger.log(`Successfully generated ${tasks.length} tasks`);
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
