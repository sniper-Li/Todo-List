require('dotenv').config();
const { app, BrowserWindow, ipcMain } = require('electron');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const moment = require('moment');
const nodemailer = require('nodemailer');
const schedule = require('node-schedule'); // 引入 node-schedule 用于调度任务

let verificationCodes = {}; // 存储邮箱验证码
let win, user, pool;

const connectionConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// 处理更新用户退出时间
async function updateLogoutTime() {
    if (user) {
        try {
            await pool.query('UPDATE users SET logout_time = ? WHERE id = ?', [moment().format('YYYY-MM-DD HH:mm:ss'), user.id]);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
}

async function createWindow() {
    win = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false
    });
    win.loadFile('loading.html');
    win.once('ready-to-show', () => {
        win.show();
        setTimeout(() => win.loadFile('login.html'), 3000);
    });
    pool = mysql.createPool(connectionConfig);
    win.on('close', async (e) => {
        if (user) {
            // 阻止默认关闭动作
            e.preventDefault();
            // 更新退出时间
            await updateLogoutTime();
            // 解除close事件监听，以便重新触发窗口关闭
            win.removeAllListeners('close');
            // 重新触发窗口关闭
            win.close();
        }
    });
}

async function sendVerificationCode(email, subject, text) {
    const code = Math.floor(Math.random() * 900000) + 100000;
    verificationCodes[email] = code;
    let transporter = nodemailer.createTransport({
        service: 'qq',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        text: text + code
    });
}

ipcMain.on('sendVerificationCode', async (event, data) => {
    try {
        await sendVerificationCode(data.email, "Your verification code", "Your verification code is ");
    } catch (error) {
        console.error('Send verification code error:', error);
    }
});

ipcMain.on('sendVerificationCodeToUser', async (event, { username }) => {
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        const email = users.length ? users[0].email : null;
        if (email) {
            await sendVerificationCode(email, "Reset password code", "Your password reset code is ");
        } else {
            console.error('User does not exist or email is undefined:', username);
            event.reply('resetPassword:error', 'User does not exist or email is undefined');
        }
    } catch (error) {
        console.error('Send verification code error:', error);
        event.reply('resetPassword:error', error.message);
    }
});

app.whenReady().then(createWindow)

app.on('window-all-closed', async () => {
    await pool.end();  // 关闭连接池
    app.quit()
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// 处理用户注册操作
ipcMain.on('register', async (event, data) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [usersByUsername] = await connection.query('SELECT * FROM users WHERE username = ?', [data.username]);
        if (usersByUsername.length > 0) {
            throw new Error('Username already exists');
        }

        const [usersByEmail] = await connection.query('SELECT * FROM users WHERE email = ?', [data.email]);
        if (usersByEmail.length > 0) {
            throw new Error('Email already exists');
        }

        // 验证邮件验证码
        if (verificationCodes[data.email] !== Number(data.code)) {
            throw new Error('Invalid email verification code');
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);
        await connection.query('INSERT INTO users (username, password, email) VALUES (?, ?, ?)', [data.username, hashedPassword, data.email]);

        await connection.commit();
        event.sender.send('register:success');
    } catch (error) {
        await connection.rollback();
        console.error('Register error:', error);
        event.sender.send('register:error', error.message);
    } finally {
        connection.release();
    }
});

// 处理用户登录操作
ipcMain.on('login', async (event, data) => {
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [data.username]);
        if (users.length === 0) {
            throw new Error('Username does not exist');
        }
        user = users[0];
        const match = await bcrypt.compare(data.password, user.password);
        if (!match) {
            throw new Error('Incorrect password');
        }
        await pool.query('UPDATE users SET login_time = ? WHERE id = ?', [moment().format('YYYY-MM-DD HH:mm:ss'), user.id]);
        event.sender.send('login:success');
        win.webContents.on('did-finish-load', () => {
            if (user) {
                win.webContents.send('username', user.username);
            }
            ipcMain.emit('getTodos');
        });
    } catch (error) {
        console.error('Login error:', error);
        event.sender.send('login:error', error.message);
    }
});

// 获取用户所有的待办事项
ipcMain.on('getTodos', async () => {
    if (!user) {
        return;
    }
    try {
        const [todos] = await pool.query('SELECT * FROM todos WHERE user_id = ?', [user.id]);
        win.webContents.send('todos', todos);
    } catch (error) {
        console.error('Get todos error:', error);
    }
});

// 处理添加待办事项操作
ipcMain.on('addTodo', async (event, newTodo) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query('INSERT INTO todos (user_id, content) VALUES (?, ?)', [user.id, newTodo]);

        await connection.commit();
        event.sender.send('addTodo:success');
        ipcMain.emit('getTodos');
    } catch (error) {
        await connection.rollback();
        console.error('Add todo error:', error);
        event.sender.send('addTodo:error', error.message);
    } finally {
        connection.release();
    }
});

// 处理退出操作
ipcMain.on('logout', async () => {
    await updateLogoutTime();
    user = null;
    win.loadFile('login.html');
});

// 处理完成事项操作
ipcMain.on('completeTodo', async (event, todoId) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query('UPDATE todos SET status = ?, completed_time = ? WHERE id = ?', ['completed', moment().format('YYYY-MM-DD HH:mm:ss'), todoId]);

        await connection.commit();
        event.sender.send('completeTodo:success');
        ipcMain.emit('getTodos');
    } catch (error) {
        await connection.rollback();
        console.error('Complete todo error:', error);
        event.sender.send('completeTodo:error', error.message);
    } finally {
        connection.release();
    }
});

// 搜寻用户的待办事项
ipcMain.on('searchTodos', async (event, searchQuery) => {
    if (!user) {
        return;
    }
    try {
        const [todos] = await pool.query('SELECT * FROM todos WHERE user_id = ? AND content LIKE ?', [user.id, `%${searchQuery}%`]);
        win.webContents.send('searchResults', todos);
    } catch (error) {
        console.error('Search todos error:', error);
    }
});

// 删除待办事项
ipcMain.on('deleteTodo', async (event, todoId) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query('DELETE FROM todos WHERE id = ?', [todoId]);

        await connection.commit();
        event.sender.send('deleteTodo:success');
        ipcMain.emit('getTodos');
    } catch (error) {
        await connection.rollback();
        console.error('Delete todo error:', error);
        event.sender.send('deleteTodo:error', error.message);
    } finally {
        connection.release();
    }
});

// 重置密码
ipcMain.on('resetPassword', async (event, { username, hashedPassword, code }) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [users] = await connection.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            throw new Error('Username does not exist');
        }
        const user = users[0];
        // 验证邮件验证码
        if (verificationCodes[user.email] !== Number(code)) {
            throw new Error('Invalid email verification code');
        }
        await connection.query('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username]);

        await connection.commit();
        event.sender.send('resetPassword:success');
    } catch (error) {
        await connection.rollback();
        console.error('Reset password error:', error);
        event.sender.send('resetPassword:error', error.message);
    } finally {
        connection.release();
    }
});

// 通过 todoId 找到用户的电子邮件地址，并根据提醒时间发送提醒邮件
ipcMain.on('setReminder', async (event, { todoId, reminderTime }) => {
    try {
        // 查询待办事项的详情，以便获取用户信息
        const [todos] = await pool.query('SELECT * FROM todos JOIN users ON todos.user_id = users.id WHERE todos.id = ?', [todoId]);
        if (todos.length === 0) {
            console.error('Todo not found:', todoId);
            return;
        }

        const todo = todos[0];
        const userEmail = todo.email;
        const reminderContent = todo.content;

        // 插入新的提醒到reminders表
        const [result] = await pool.query('INSERT INTO reminders (todo_id, reminder_time, status) VALUES (?, ?, 1)', [todoId, reminderTime]);
        const reminderId = result.insertId;

        // 定时任务：在提醒时间发送提醒邮件
        schedule.scheduleJob(reminderTime, async () => {
            try {
                await sendReminderEmail(userEmail, reminderContent);
                // 更新提醒的状态为已提醒
                await pool.query('UPDATE reminders SET status = 0 WHERE id = ?', [reminderId]);
            } catch (error) {
                console.error('Send reminder email error:', error);
            }
        });

        console.log(`Reminder set for todo ${todoId} at ${reminderTime}`);
    } catch (error) {
        console.error('Set reminder error:', error);
    }
});

// 定义发送提醒邮件的函数
async function sendReminderEmail(email, content) {
    let transporter = nodemailer.createTransport({
        service: 'qq',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Todo Reminder',
        text: `Reminder for your todo: ${content}`
    });
    console.log(`Reminder email sent to ${email}`);
}

// 加载页面
ipcMain.on('loadPage', (event, page) => {
    win.loadFile(`${page}`);
});
