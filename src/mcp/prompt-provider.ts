import logger from '../utils/logger';

/**
 * MCP prompt definition
 */
export interface McpPrompt {
  name: string;
  description: string;
  text: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

/**
 * MCP prompt provider class
 * Manages prompt templates related to Google Calendar
 */
export class PromptProvider {
  private readonly prompts: McpPrompt[] = [
    {
      name: 'view_upcoming_events',
      description: 'Show my upcoming events',
      text: 'Show my upcoming events for the next week'
    },
    {
      name: 'create_meeting',
      description: 'Create a new meeting',
      text: 'Create a meeting titled "Team Sync" tomorrow from 10am to 11am'
    },
    {
      name: 'find_free_time',
      description: 'Find available time slots',
      text: 'Find free time slots in my calendar for next Monday'
    },
    {
      name: 'reschedule_event',
      description: 'Reschedule an existing event',
      text: 'Reschedule my "Dentist Appointment" to next Friday at 2pm'
    },
    {
      name: 'cancel_event',
      description: 'Cancel an existing event',
      text: 'Cancel my meeting scheduled for tomorrow at 3pm'
    },
    {
      name: 'weekly_schedule_overview',
      description: 'Get a weekly schedule overview',
      text: 'Show me a summary of my schedule for this week, including total meeting time and free slots'
    },
    {
      name: 'create_recurring_meeting',
      description: 'Create a recurring meeting',
      text: 'Create a weekly team standup meeting every Monday at 9am for the next 3 months'
    },
    {
      name: 'find_meeting_conflicts',
      description: 'Check for scheduling conflicts',
      text: 'Check if I have any scheduling conflicts for the meeting I want to schedule next Tuesday at 2pm'
    },
    {
      name: 'prepare_for_today',
      description: 'Get today\'s schedule summary',
      text: 'Show me today\'s schedule with meeting details and preparation reminders'
    },
    {
      name: 'schedule_around_event',
      description: 'Schedule new events around existing ones',
      text: 'I need to schedule a 1-hour meeting with the marketing team. Find the best time this week that doesn\'t conflict with my existing appointments'
    }
  ];

  /**
   * Get list of available prompts
   */
  public getPromptList(): { prompts: McpPrompt[] } {
    logger.debug('Providing prompt list');
    return { prompts: this.prompts };
  }

  /**
   * Get specific prompt by name
   */
  public getPrompt(name: string): McpPrompt | undefined {
    return this.prompts.find(prompt => prompt.name === name);
  }

  /**
   * Get prompts by category
   */
  public getPromptsByCategory(): { 
    basic: McpPrompt[];
    advanced: McpPrompt[];
    recurring: McpPrompt[];
    analysis: McpPrompt[];
    } {
    const basicPrompts = this.prompts.filter(p => 
      ['view_upcoming_events', 'create_meeting', 'cancel_event'].includes(p.name)
    );
    
    const advancedPrompts = this.prompts.filter(p => 
      ['find_free_time', 'reschedule_event', 'schedule_around_event'].includes(p.name)
    );
    
    const recurringPrompts = this.prompts.filter(p => 
      ['create_recurring_meeting'].includes(p.name)
    );
    
    const analysisPrompts = this.prompts.filter(p => 
      ['weekly_schedule_overview', 'find_meeting_conflicts', 'prepare_for_today'].includes(p.name)
    );

    return {
      basic: basicPrompts,
      advanced: advancedPrompts,
      recurring: recurringPrompts,
      analysis: analysisPrompts
    };
  }

  /**
   * Add new prompt (for extension)
   */
  public addPrompt(prompt: McpPrompt): void {
    // Check if name conflicts with existing ones
    if (this.getPrompt(prompt.name)) {
      throw new Error(`Prompt with name ${prompt.name} already exists`);
    }
    
    this.prompts.push(prompt);
    logger.debug(`Added new prompt: ${prompt.name}`);
  }

  /**
   * Search prompts
   */
  public searchPrompts(query: string): McpPrompt[] {
    const lowerQuery = query.toLowerCase();
    return this.prompts.filter(prompt => 
      prompt.name.toLowerCase().includes(lowerQuery) ||
      prompt.description.toLowerCase().includes(lowerQuery) ||
      prompt.text.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get prompt statistics
   */
  public getStatistics(): { 
    totalPrompts: number; 
    categories: Record<string, number>;
    mostCommonWords: string[];
    } {
    const categories = this.getPromptsByCategory();
    const categoryStats = {
      basic: categories.basic.length,
      advanced: categories.advanced.length,
      recurring: categories.recurring.length,
      analysis: categories.analysis.length
    };

    // 最も一般的な単語を分析
    const allWords = this.prompts.flatMap(p => 
      (p.description + ' ' + p.text).toLowerCase().split(/\s+/)
    );
    const wordCount = allWords.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostCommonWords = Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);

    return {
      totalPrompts: this.prompts.length,
      categories: categoryStats,
      mostCommonWords
    };
  }

  /**
   * Prompt validation
   */
  public validatePrompt(prompt: McpPrompt): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!prompt.name || prompt.name.trim().length === 0) {
      errors.push('Prompt name is required');
    }

    if (!prompt.description || prompt.description.trim().length === 0) {
      errors.push('Prompt description is required');
    }

    if (!prompt.text || prompt.text.trim().length === 0) {
      errors.push('Prompt text is required');
    }

    if (prompt.name && !/^[a-z_][a-z0-9_]*$/.test(prompt.name)) {
      errors.push('Prompt name must be lowercase with underscores only');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}