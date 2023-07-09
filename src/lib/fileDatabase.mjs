import fs from 'fs/promises';

export class FileDatabase {
    constructor(filePath) {
        this.filePath = filePath;

        fs.access(this.filePath)
            .catch(() => this.writeData([]));
    }

    async readData() {
        const data = await fs.readFile(this.filePath);
        return JSON.parse(data);
    }

    writeData(data) {
        return fs.writeFile(this.filePath, JSON.stringify(data, null, 4));
    }

    async getItems() {
        return await this.readData();
    }

    async getItem(predicate) {
        const items = await this.getItems();
        return items.find(predicate);
    }

    async createItem(item) {
        const data = await this.readData();
        data.push({...item, createdAt: new Date()});
        await this.writeData(data);
    }

    async createItems(items) {
        const data = await this.readData();
        items.forEach(item => data.push({...item, createdAt: new Date()}));
        await this.writeData(data);
    }

    async removeItem(predicate)
    {
        let data = await this.readData();
        data = data.map(item => predicate(item) ? null : item)
            .filter(item => item !== null);
        await this.writeData(data);
    }

    async createOrUpdate(items, uniqueKey) {
        let data = await this.readData();

        data = data.map(existingItem => {
            for (let item of items) {
                if (existingItem[uniqueKey] === item[uniqueKey]) {
                    return {...existingItem, ...item, updatedAt: new Date()};
                }
            }
            return existingItem;
        });

        const newData = items.filter(item => 
            !data.some(existingItem => existingItem[uniqueKey] === item[uniqueKey])
        );
    
        newData.forEach(item => data.push({...item, createdAt: new Date()}));
        
        await this.writeData(data);
    }
}
