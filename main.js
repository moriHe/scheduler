const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Define a path for storing the user data
const dataFilePath = path.join(app.getPath('userData'), 'users.json');

// Create a window when the app is ready
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');

  // Send the stored user data to the frontend
  ipcMain.handle('load-users', () => {
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath);
      try {
        const parsedData = JSON.parse(data);
        return Array.isArray(parsedData) ? parsedData : []; // Ensure parsedData is an array
      } catch (error) {
        console.error('Error parsing JSON:', error);
        return []; // Return an empty array if there's an error
      }
    } else {
      return []; // Return an empty array if the file does not exist
    }
  });

  // Save a new user to the file
  ipcMain.on('save-users', (event, user) => {
    let users = [];

    // Load existing users if the file exists
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath);
      try {
        const parsedData = JSON.parse(data);
        users = Array.isArray(parsedData) ? parsedData : []; // Ensure parsedData is an array
      } catch (error) {
        console.error('Error parsing JSON on save:', error);
        users = []; // If parsing fails, treat it as an empty array
      }
    }

    // Add the new user to the list
    users.push(user);
    fs.writeFileSync(dataFilePath, JSON.stringify(users, null, 2)); // Pretty-print JSON with indentation
  });

    // Reset users JSON file
    ipcMain.on('reset-users', () => {
        if (fs.existsSync(dataFilePath)) {
            fs.unlinkSync(dataFilePath); // Delete the users.json file
        }
        console.log('Users JSON file has been reset.');
    });

    // Logic to delete the user from your data source
    ipcMain.on('delete-user', (event, userName) => {
      if (fs.existsSync(dataFilePath)) {
          const data = fs.readFileSync(dataFilePath);
          try {
              const parsedData = JSON.parse(data);
              if (Array.isArray(parsedData)) {
                  // Filter out the user to delete
                  const updatedUsers = parsedData.filter(user => user !== userName);
                  
                  // Save the updated list back to the file
                  fs.writeFileSync(dataFilePath, JSON.stringify(updatedUsers, null, 2));
                  console.log(`User ${userName} deleted successfully.`);
              }
          } catch (error) {
              console.error('Error parsing JSON on delete:', error);
          }
      }
    });
  


  // Handle navigation between pages
  ipcMain.on('navigate', (event, page) => {
    win.loadFile(page); // Load the specified page
  });

  ipcMain.handle('save-pdf-dialog', async () => {
    const result = await dialog.showSaveDialog({
        title: 'Save PDF',
        defaultPath: 'Elterndienst.pdf', // Default file name
        filters: [
            { name: 'PDF Files', extensions: ['pdf'] }
        ]
    });

    return result;
});
}

app.whenReady().then(createWindow);
