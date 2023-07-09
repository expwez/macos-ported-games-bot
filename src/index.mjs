import cron from 'node-cron';
import dotenv from 'dotenv';
import { escapeCharacters } from './util.mjs';
import { getGamesList } from './lib/appleGamingWiki.mjs';
import { log } from './log.mjs';
import { chatsDb, gamesDb, getGameLatestRating } from './databases.mjs';
import { gamesCommand, gamesPaginationHandler } from './commands/games.mjs';
import changesCommand from './commands/changes.mjs';
import { ResilientTelegramBot } from './lib/resilientTelegramBot.mjs';

dotenv.config();

const bot = new ResilientTelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});

const addChatIdToDataStore = async (msg) => {
    const chats = await chatsDb.getItems();
    const chatIds = chats.map(chat => chat.telegramId);
    if (!chatIds.includes(msg.chat.id)) {
        await chatsDb.createItem({telegramId: msg.chat.id});
        log(`Added chat ${msg.chat.id}`);
    }
};

const removeChatIdFromDataStore = async (msg) => {
    const chats = await chatsDb.getItems();
    const chatIds = chats.map(chat => chat.telegramId);
    const chatIndex = chatIds.indexOf(msg.chat.id);
    if (chatIndex !== -1) {
        await chatsDb.removeItem((item) => item.telegramId === msg.chat.id);
        log(`Removed chat ${msg.chat.id}`);
    }
};

bot.on('message', addChatIdToDataStore);
bot.on('left_chat_member', removeChatIdFromDataStore);
bot.on('polling_error', (error) => {
    log(error); 
});

bot.onText(new RegExp('/changes'), changesCommand(bot));
bot.onText(new RegExp('/games'), gamesCommand(bot));

bot.on('callback_query', gamesPaginationHandler(bot));

const recordChanges = async (games) => {
    const newGames = [];
    const updatedGames = [];

    for (let game of games) {
        const gameInDb = await gamesDb.getItem((g) => g.title === game.title);

        if (gameInDb) {
            const latestRating = getGameLatestRating(gameInDb);
            if (latestRating !== game.rating) {
                gameInDb.ratings.push({ rating: game.rating, addedAt: new Date() });
                updatedGames.push({...gameInDb, oldRating: latestRating});

                log(`Updated game ${gameInDb.title} from ${latestRating} to ${game.rating}`);
            }
        } else {
            const newGame = {
                ...game,
                ratings: [{ rating: game.rating, addedAt: new Date() }]
            };
            newGames.push(newGame);
            
            log(`Added new game ${newGame.title} with rating ${newGame.rating}`);
        }
    }

    if (newGames.length > 0) {
        await gamesDb.createItems(newGames);
    }

    if (updatedGames.length > 0) {
        await gamesDb.createOrUpdate(updatedGames, 'title');
    }

    return {newGames, updatedGames};
};

const sendGamesUpdatesNotification = async (chats, newGames, updatedRatings) => {
    let message = '';

    for (let game of newGames) {
        message += formatGameMessage(game, `Unknown → ${game.rating}`);
    }

    for (let game of updatedRatings) {
        message += formatGameMessage(game, `${game.oldRating} → ${game.rating}`);
    }

    if (message) {
        for (let chatId of chats) {
            try {
                await bot.sendMessage(chatId, message, { parse_mode: "MarkdownV2" });
            } catch (error) {
                if (error.response && error.response.statusCode === 403) {
                    console.log(`Removing chatId ${chatId} from the database`);
                    await chatsDb.removeItem((item) => item.telegramId === chatId);
                }
            }
        }
    }
};

const formatGameMessage = (game, ratingChange) => {
    return `🎮 [*${escapeCharacters(game.title)}*](${escapeCharacters(game.link)})\n${ratingChange}\n\n`;
};

const fetchNewGames = async () => {
    const games = await getGamesList();

    const {newGames, updatedGames} = await recordChanges(games);

    if (newGames.length > 0 || updatedGames.length > 0) {
        const chats = await chatsDb.getItems();
        await sendGamesUpdatesNotification(chats.map((chat) => chat.telegramId), newGames, updatedGames);
    }
};

const main = async () => {
    log('Bot started');
    fetchNewGames();
    cron.schedule('*/3 * * * *', fetchNewGames);
}

main()


