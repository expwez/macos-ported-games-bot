import TelegramBot from 'node-telegram-bot-api';
import { log } from '../log.mjs';

class ErrorHandler {
    static async handle(fn, ...args) {
        while (true) {
            try {
                return await fn(...args);
            } catch (error) {
                log(error);
                if (this.isRateLimitExceededError(error)) {
                    const delay = error.response.body.parameters.retry_after;
                    await new Promise(resolve => setTimeout(resolve, delay * 1000));
                } else if (this.isMessageNotModifiedError(error)) {
                    return;
                } else {
                    // throw error;
                }
            }
        }
    }

    static isRateLimitExceededError(error) {
        return error.response && error.response.statusCode === 429;
    }

    static isMessageNotModifiedError(error) {
        return error.response && error.response.statusCode === 400 
            && error.response.description === "Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message";
    }
}

export class ResilientTelegramBot extends TelegramBot {
    constructor(token, options) {
        super(token, options);
    }

    async sendMessage(chatId, text, options) {
        return await ErrorHandler.handle(super.sendMessage.bind(this), chatId, text, options);
    }

    async editMessageText(text, options) {
        return await ErrorHandler.handle(super.editMessageText.bind(this), text, options);
    }
}