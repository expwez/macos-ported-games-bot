import cron from 'node-cron';
import dotenv from 'dotenv';
import { getGamesList } from './lib/appleGamingWiki.mjs';
import { log } from './log.mjs';
import { chatsDb, gamesDb } from './databases.mjs';
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
    await chatsDb.removeItem((item) => item.telegramId === msg.chat.id);
    log(`Removed chat ${msg.chat.id}`);
};

bot.on('message', addChatIdToDataStore);
bot.on('left_chat_member', removeChatIdFromDataStore);
bot.on('polling_error', (error) => {
    log(error); 
});

bot.onText(new RegExp('/changes'), changesCommand(bot));
bot.onText(new RegExp('/games'), gamesCommand(bot));

bot.on('callback_query', gamesPaginationHandler(bot));

const addNewGame = (game) => {
    const newGame = {
        title: game.title,
        link: game.link,
        ratings: [{ rating: game.rating, addedAt: new Date() }]
    };

    log(`Added new game ${newGame.title} with rating ${newGame.rating}`);
    return newGame;
};

const updateGame = (gameInDb, newRating) => {
    gameInDb.ratings.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    const currentRating = gameInDb.ratings[0].rating;

    if (currentRating !== newRating) {
        gameInDb.ratings.push({ rating: newRating, addedAt: new Date() });

        const updatedGame = {
            title: gameInDb.title,
            link: gameInDb.link,
            ratings: gameInDb.ratings
        };
        
        log(`Updated game ${updatedGame.title} from ${currentRating} to ${newRating}`);
        return updatedGame;
    }

    return null;
};


const recordChanges = async (games) => {
    const newGames = [];
    const updatedGames = [];

    for (let game of games) {
        const gameInDb = await gamesDb.getItem((g) => g.title === game.title);

        if (gameInDb) {
            const updatedGame = updateGame(gameInDb, game.rating);
            if (updatedGame) {
                updatedGames.push(updatedGame);
            }
        } else {
            newGames.push(addNewGame(game));
        }
    }

    if (newGames.length > 0) {
        await gamesDb.createItems(newGames);
    }

    if (updatedGames.length > 0) {
        await gamesDb.createOrUpdate(updatedGames, 'title');
    }

    return { newGames, updatedGames };
};

const sendGamesUpdatesNotification = async (chats, newGames, updatedRatings) => {
    let message = '';

    for (let game of newGames) {
        game.ratings.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
        message += formatGameMessage(game, `Unknown → ${game.ratings[0].rating}`);
    }

    for (let game of updatedRatings) {
        game.ratings.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
        const oldRating = game.ratings.length > 1 ? game.ratings[1].rating : "Unknown";
        message += formatGameMessage(game, `${oldRating} → ${game.ratings[0].rating}`);
    }

    if (message) {
        for (let chatId of chats) {
            try {
                await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
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
    return `🎮 <a href="${game.link}"><b>${game.title}</b></a>\n${ratingChange}\n\n`;
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


