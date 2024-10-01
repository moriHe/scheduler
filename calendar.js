const PDFDocument = require('pdfkit');
const fs = require('fs');
const { format } = require("date-fns")
const { de } = require("date-fns/locale")

function assignUsersToCalendar(month, year, users, options = {}) {
    const daysInMonth = new Date(year, month, 0).getDate(); // Get the number of days in the month
    const calendar = {}; // To store the user assignments per day
    const userPinnedCount = {}; // To track how many days each user is pinned

    // Set default options for weekdays and holidays
    const { weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], holidays = [], teamdays = [] } = options;

    // Initialize pinned count for each user to 0
    users.forEach(user => {
        userPinnedCount[user.name] = 0;
    });

    // Helper function to check if a user is available on a particular day
    function isUserAvailable(user, date) {
        const formattedDate = `${year}-${month}-${date}`;
        return !user.not_available.includes(formattedDate);
    }

    // Helper function to check if a day is a holiday
    function isHoliday(date) {
        const formattedDate = `${year}-${month}-${date}`;
        return holidays.includes(formattedDate);
    }

    function isTeamDay(date) {
        const formattedDate = `${year}-${month}-${date}`;
        return teamdays.includes(formattedDate) 
    }

    // Helper function to check if a day is within the valid weekdays
    function isValidWeekday(day) {
        const date = new Date(year, month - 1, day);
        const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
        return weekdays.includes(weekday);
    }

    // Helper function to get the least pinned available users
    function getAvailableUsersForDay(day) {
        return users
            .filter(user => isUserAvailable(user, day)) // Filter users who are available for the day
            .sort((a, b) => userPinnedCount[a.name] - userPinnedCount[b.name]); // Sort by how many times they've been pinned
    }

    // Iterate over each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
        // Skip the day if it's a holiday or not a valid weekday
        if (!isValidWeekday(day) || isHoliday(day)) {
            continue;
        }

        const availableUsers = getAvailableUsersForDay(day);


        if (isTeamDay(day)) {
            // If it's a team day, assign one user and mark the second slot as "Team"
            if (availableUsers.length < 1) {
                throw new Error(`No available users for team day ${day}`);
            }

            const selectedUser = availableUsers[0]; // Get the first available user
            calendar[day] = [selectedUser.name, 'Team']; // Assign user and "Team" for the second slot
            userPinnedCount[selectedUser.name]++; // Increment the pinned count for the selected user

        } else {
        // If fewer than 2 users are available for the day, we cannot assign it properly
            if (availableUsers.length < 2) {
                throw new Error(`Not enough users available for day ${day}`);
            }

            // Pick the top two least pinned users for the day
            const selectedUsers = availableUsers.slice(0, 2);

            // Assign these users to the calendar for the current day
            calendar[day] = selectedUsers.map(user => user.name);

            // Increment the pinned count for each selected user
            selectedUsers.forEach(user => {
                userPinnedCount[user.name]++;
            });
        }
    }

    return calendar;
}

// Helper function to format the date in the "1. Okt. Dienstag" format
function formatDate(day, month, year) {
    const date = new Date(year, month - 1, day);
    const options = { day: 'numeric', month: 'short', weekday: 'long' };
    return date.toLocaleDateString('de-DE', options); // Use "de-DE" for German format
}

// Function to generate the PDF
function generatePDF(calendar, month, year, filePath) {
    // Create a new PDF document
    const doc = new PDFDocument();

    // Pipe the output to a file
    doc.pipe(fs.createWriteStream(filePath));

    // Add a title
    doc.fontSize(18).text(`Elterndienst ${format(new Date(year, month - 1), "MMMM yyyy", {locale: de})}`, {
        align: 'center'
    });

    // Add some space
    doc.moveDown();

    // Define table headers
    doc.fontSize(12).text('Date', { continued: true, underline: true }).text('Elternpaar 1', { continued: true, underline: true, align: 'center' }).text('Elternpaar 2', { underline: true, align: 'right' });
    doc.moveDown(0.5);

    // Iterate through the calendar data and generate rows
    for (const day in calendar) {
        const [parent1, parent2] = calendar[day];
        const formattedDate = formatDate(day, month, year);

        // Create a row in the table
        doc.fontSize(10)
            .text(formattedDate, { continued: true })
            .text(parent1, { continued: true, align: 'center' })
            .text(parent2, { align: 'right' });

        // Add some space after each row
        doc.moveDown(0.5);
    }

    // Finalize the PDF and end the stream
    doc.end();
}

// Export the functions for use in other modules
module.exports = {
    assignUsersToCalendar,
    generatePDF
};
