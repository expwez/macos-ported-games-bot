import { gamesDb } from "../databases.mjs";

const PAGE_SIZE = 10;
const MIN_TITLE_LENGTH = 40;

const formatGameMessage = (game) => {
    const title = game.title;
    const spacer = title.length < MIN_TITLE_LENGTH ? ' '.repeat(MIN_TITLE_LENGTH - title.length): '';

    return `🎮 <a href="${game.link}"><b>${game.title}</b></a>${spacer}\nRating: <b>${game.rating}</b>\n`;
};

export const gamesCommand = (bot) => async (msg) => {
    const chatId = msg.chat.id;
    await sendOrUpdateGamesList(bot, chatId);
};
export const gamesPaginationHandler = (bot) => async (msg) => {
    const chatId = msg.message.chat.id;
    const messageId = msg.message.message_id;
    
    const callbackData = JSON.parse(msg.data);
    const data = callbackData.data;

    if (callbackData === 'noop') {
        return; 
    }

    await sendOrUpdateGamesList(bot, chatId, messageId, data.page);
};

const sendOrUpdateGamesList = async (bot, chatId, messageId = null, page = 1) => {
    const games = await gamesDb.getItems();
    games.sort((a, b) => a.title.localeCompare(b.title));

    const totalPages = Math.ceil(games.length / PAGE_SIZE);

    const gamesOnPage = games.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const message = gamesOnPage.map(formatGameMessage).join('\n');

    const keyboard = createPaginationContext(page, totalPages, "GAMES_PAGINATION")

    if (messageId) {
        await bot.editMessageText(message, { 
            chat_id: chatId, 
            message_id: messageId, 
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    } else {
        await bot.sendMessage(chatId, message, { parse_mode: 'HTML', reply_markup: keyboard });
    }
};

const createPaginationContext = (page, totalPages, type) => {
    const createButton = (text, targetPage) => ({
        text: text,
        callback_data: JSON.stringify({
            type: type,
            data: { page: targetPage }
        })
    });

    const keyboardButtons = [
        createButton(page > 1 ? '←' : ' ', page - 1),
        { text: `${page} / ${totalPages}`, callback_data: JSON.stringify('noop') },
        createButton(page < totalPages ? '→' : ' ', page + 1),
    ];

    return totalPages > 1 ? { inline_keyboard: [keyboardButtons] } : undefined;
};
