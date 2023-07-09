
import fetch from 'node-fetch';
import { load } from 'cheerio';

export const getGamesList = async () => {
    const response = await fetch('https://www.applegamingwiki.com/wiki/Game_Porting_Toolkit#Game_compatibility_list');
    const html = await response.text();
    const $ = load(html);
    const gamesRows = $('#table-listofgames .table-listofgames-body-row');

    const now = new Date().toISOString();

    return gamesRows.map((index, row) => {
        const title = $(row).find('a').first().attr('title');
        const link = 'https://www.applegamingwiki.com' + $(row).find('a').first().attr('href');
        const rating = $(row).find('.rating').first().text();
        return { title, link, rating, updated: now };
    }).get();
};