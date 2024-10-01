const PDFDocument = require('pdfkit-table');
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
            calendar[day] = ["", ""]
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
    return format(date, 'dd.MM.yy', { locale: de });
}

// Helper function to get day of the week as "Mo, Di, Mi" etc.
function formatDayOfWeek(day, month, year) {
    const date = new Date(year, month - 1, day);
    return format(date, 'EE', { locale: de }); // Format as short day, e.g., "Mo" for Monday
}

// Function to generate the PDF
async function generatePDF(calendar, month, year, filePath, excludedDays, holidays) {
    // Create a new PDF document with margins
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    // Pipe the output to a file
    doc.pipe(fs.createWriteStream(filePath));

    // Add a title
    doc.fontSize(18).text(`Elterndienstplan`, { align: 'center' });
    doc.fontSize(14).text(`${format(new Date(year, month - 1), 'MMMM yyyy', { locale: de })}`, { align: 'center' });

    // Add some space
    doc.moveDown(2);

    let rows = []

    for (const day in calendar) {
        const [parent1, parent2] = calendar[day];
        let dateParent1 = `${formatDate(day, month, year)}`
        let dayParent1 = `${formatDayOfWeek(day, month, year)}`
        let dateParent2 = `${formatDate(day, month, year)}`
        let dayParent2 = `${formatDayOfWeek(day, month, year)}`

        if (parent2 === "") {
            dayParent2 = ""
            dateParent2 = ""
        }
        rows.push([dayParent1, dateParent1, parent1, dayParent2, dateParent2, parent2])
    }


    // Prepare the table data with headers
    const table = {
        headers: ['Tag', 'Datum', 'Elternpaar 1', 'Tag', 'Datum', 'Elternpaar 2'],
        rows
    };

    // Configure the table rendering
    doc.table(table, {
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8),
        prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
            doc.fillColor("#000000");
            doc.font("Helvetica")
            doc.fontSize(8);

            if (row[2] === "" && row[5] === "") {
                doc.addBackground(rectCell, "#FFCCCB", 0.5)
                doc.fillColor("lightgray")
            } else if (indexRow % 2 !== 0) {
                doc.addBackground(rectCell, 'lightgray', 0.5);
            }

        },
        columnsSize: [20, 40, 250, 20, 40, 220],
        minRowHeight: 15
    });    
    
    

    // Finalize the document and write the file
    doc.end();
}

// Export the functions for use in other modules
module.exports = {
    assignUsersToCalendar,
    generatePDF
};
