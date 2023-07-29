import { gamesDb, getGameLatestRating } from "../databases.mjs";

const getChangesInLastDay = (games) => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24 hours ago

    const recentChanges = games.filter(game => new Date(game.updatedAt) > oneDayAgo);
    const newGames = games.filter(game => new Date(game.createdAt) > oneDayAgo);

    return { recentChanges, newGames };
};

const formatChangesMessage = (recentChanges, newGames) => {
    let message = '';

    for (let game of recentChanges) {
        const previousRating = game.ratings[game.ratings.length - 2]?.rating || 'Unknown';
        const latestRating = getGameLatestRating(game);
        message += `🎮 <a href="${game.link}"><b>${game.title}</b></a>\n${previousRating} → ${latestRating}\n\n`;
    }

    for (let game of newGames) {
        const latestRating = game.ratings[game.ratings.length - 1].rating;
        message += `🎮 <a href="${game.link}"><b>${game.title}</b></a>\nMissing → ${latestRating}\n\n`;
    }

    if (message === '') {
        message = 'No games were added or had their ratings changed in the last day.';
    }

    return message;
};

const changesCommand = (bot) => async (msg, match) => {
    const chatId = msg.chat.id;

    const games = await gamesDb.getItems();
    const { recentChanges, newGames } = getChangesInLastDay(games);

    const message = formatChangesMessage(recentChanges, newGames);

    bot.sendMessage(chatId, message, { parse_mode: "HTML" });
};

export default changesCommand;
