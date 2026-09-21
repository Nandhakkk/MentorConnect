/**
 * AI Service — Google Gemini integration for MentorConnect.
 * API key is read from environment variable and never exposed to the frontend.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    this.apiKey = process.env.AI_SERVICE_API_KEY || null;
    // Default to gemini-1.5-flash which is available in current SDK versions
    this.modelName = process.env.AI_SERVICE_MODEL || 'gemini-1.5-flash';
    this.client = null;
  }

  /**
   * Lazily initialize the Gemini client.
   */
  _getClient() {
    if (!this.apiKey) {
      throw new Error('AI_SERVICE_API_KEY is not configured.');
    }
    if (!this.client) {
      this.client = new GoogleGenerativeAI(this.apiKey);
    }
    return this.client;
  }

  /**
   * Send a prompt to Gemini and return the generated text.
   * @param {string} prompt - Full prompt string
   * @returns {Promise<string>} - Generated text response
   */
  async generateText(prompt) {
    const genAI = this._getClient();
    const model = genAI.getGenerativeModel({ model: this.modelName });
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  }

  /**
   * Build the AI prompt from student context and their question.
   * @param {object} context - { goals: [...] }
   * @param {string} question - The student's question
   * @returns {string} - Assembled prompt
   */
  buildPrompt(context, question) {
    let contextBlock = '';

    if (context.goals && context.goals.length > 0) {
      context.goals.forEach((goal, i) => {
        contextBlock += `\nGoal ${i + 1}: ${goal.title}`;
        if (goal.description) contextBlock += `\n  Description: ${goal.description}`;
        contextBlock += `\n  Status: ${goal.status}`;
        if (goal.targetDate) {
          contextBlock += `\n  Target Date: ${new Date(goal.targetDate).toLocaleDateString()}`;
        }
        if (goal.milestones && goal.milestones.length > 0) {
          contextBlock += '\n  Milestones:';
          goal.milestones.forEach((m) => {
            contextBlock += `\n    - [${m.status}] ${m.title}`;
            if (m.dueDate) contextBlock += ` (due ${new Date(m.dueDate).toLocaleDateString()})`;
          });
        } else {
          contextBlock += '\n  Milestones: None defined yet.';
        }
        contextBlock += '\n';
      });
    } else {
      contextBlock = '\nNo active goals defined yet.\n';
    }

    return `You are MentorConnect's AI Learning Assistant.

You help students make progress toward their learning and career goals.
Use the student's goals and milestones as context.
Give practical, personalized and concise guidance.
Do not invent information about the student's progress.

When appropriate:
- Identify what they should focus on next.
- Break large goals into manageable steps.
- Suggest realistic learning activities.
- Explain how their milestones relate to their overall goal.
- Point out incomplete milestones that need attention.
- Suggest a weekly plan if relevant.

Keep your response clear, structured, and encouraging. Use bullet points where helpful.

--- Student's Goals and Milestones ---
${contextBlock}
--------------------------------------

Student's Question:
${question}

Your Answer:`;
  }
}

module.exports = new AIService();
