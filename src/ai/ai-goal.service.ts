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

@Injectable()
export class AiGoalService {
  private readonly logger = new Logger(AiGoalService.name);
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

}
