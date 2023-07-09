import fs from 'fs';

const logFilePath = 'log.log';

const log = (message) => {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFilePath, formattedMessage);
    console.log(formattedMessage); 
};

export { log };