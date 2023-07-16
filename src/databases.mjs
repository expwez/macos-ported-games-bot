import { FileDatabase } from "./lib/fileDatabase.mjs";

export const gamesDb = new FileDatabase('data/games.json');
export const chatsDb = new FileDatabase('data/chats.json');

export const getGameLatestRating = (game) => {
    if (game.ratings && game.ratings.length > 0) {
        const sortedRatings = [...game.ratings].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
        return sortedRatings[0].rating;
    } else {
        return null;
    }
};