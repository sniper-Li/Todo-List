const { ipcRenderer } = require('electron');
const Swal = require('sweetalert2');
const moment = require('moment');
const bcrypt = require('bcrypt');

// 通用验证函数
const validateInput = (input, regex, errorMessage) => {
  if (!input || (regex && !regex.test(input))) {
    Swal.fire("Error", errorMessage, "error");
    return false;
  }
  return true;
};

// 监听主进程事件的通用函数
const handleIpcEvent = (eventType, operation, successMessage, onSuccess) => {
  ipcRenderer.on(`${eventType}:success`, async () => {
    await Swal.fire('Success', successMessage, 'success');
    if (onSuccess) onSuccess();
  });

  ipcRenderer.on(`${eventType}:error`, (event, message) => {
    Swal.fire('Error', `${operation}失败: ${message}`, 'error');
  });
};

// 创建一个发送验证码并返回验证码的函数
async function sendVerificationCode(emailOrUsername, eventName, requestEventName) {
  let timeLeft = 60;
  let code;
  let timer;
  while (true) {
    ipcRenderer.send(requestEventName, { [eventName]: emailOrUsername });
    clearInterval(timer);
    timer = setInterval(() => {
      timeLeft -= 1;
      const percentage = ((60 - timeLeft) / 60) * 100;
      const offset = 100 - percentage;
      const isLastTenSeconds = timeLeft <= 10;
      const color = isLastTenSeconds ? '#FF0000' : '#4CAF50';
      const textFill = isLastTenSeconds ? '#FF4500' : '#333';
      const shake = isLastTenSeconds ? `rotate(${timeLeft % 2 === 0 ? '1' : '-1'}deg)` : 'rotate(0deg)';
      Swal.update({
        title: `Enter your email verification code`,
        html: `<svg viewBox="0 0 36 36" style="width: 80px; height: 80px; margin: 20px auto; transform: ${shake}; transition: transform 0.1s ease;">
                 <path style="fill: none; stroke: #ddd; stroke-width: 3.8;"
                       d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831" />
                 <path id="circle" style="fill: none; stroke: ${color}; stroke-width: 2.8; stroke-dasharray: 100; stroke-dashoffset: ${offset};"
                       d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831" />
                 <text x="18" y="20.35" font-size="10" text-anchor="middle" fill="${textFill}">${timeLeft}s</text>
               </svg>`
      });
      if (timeLeft <= 0) {
        clearInterval(timer);
        Swal.close();
      }
    }, 1000);
    const result = await Swal.fire({
      title: `Enter your email verification code (${timeLeft} seconds left)`,
      input: 'text',
      inputPlaceholder: 'Email verification code',
      inputValidator: (value) => {
        if (!value) {
          return '验证码不能为空！';
        }
      },
      showCancelButton: true,
      onClose: () => {
        clearInterval(timer);
      },
    });
    if (result.dismiss === 'cancel' || result.dismiss === 'backdrop' || result.dismiss === 'esc') {
      break;
    }
    if (timeLeft <= 0) {
      const res = await Swal.fire({
        title: 'Time is up!',
        text: 'Do you want to resend the verification code?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, send again!',
        cancelButtonText: 'No, cancel!'
      });
      if (!res.isConfirmed) {
        break;
      }
      timeLeft = 60;
    } else if (result.value) {
      code = result.value;
      break;
    }
  }
  clearInterval(timer);
  return code;
}

// 用户登录逻辑
document.querySelector("#loginForm")?.addEventListener("submit", event => {
  event.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  if (validateInput(username, null, "用户名不能为空") && validateInput(password, null, "密码不能为空")) {
    ipcRenderer.send('login', { username, password });
  }
});

// 重置密码逻辑
document.getElementById('resetPasswordForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const username = document.getElementById('username').value;
  const newPassword = document.getElementById('newPassword').value;
  if (
    validateInput(username, null, "用户名不能为空") &&
    validateInput(newPassword, /^.{6,}$/, "密码至少6个字符")
  ) {
    const code = await sendVerificationCode(username, 'username', 'sendVerificationCodeToUser');
    if (code) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      ipcRenderer.send('resetPassword', { username, hashedPassword, code });
    }
  }
});

// 注册逻辑
document.querySelector("#registerForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const email = document.getElementById("email").value;

  if (
    validateInput(username, /^[a-zA-Z]\w{2,}$/, "用户名至少三个字符，只能包含英文、数字和下划线，只能以英文开头") &&
    validateInput(password, /^.{6,}$/, "密码至少6个字符") &&
    validateInput(email, null, "电子邮箱不能为空") &&
    validateInput(password === confirmPassword, null, "两次输入的密码不相等")
  ) {
    const code = await sendVerificationCode(email, 'email', 'sendVerificationCode');
    if (code) {
      ipcRenderer.send('register', { username, password, email, code });
    }
  }
});

// 处理待办事项的添加
const addTodoForm = document.querySelector("#addTodoForm");
if (addTodoForm) {
  addTodoForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const newTodo = document.getElementById("newTodo").value;
    if (!newTodo) {
      return Swal.fire("Error", "请输入代办事项", "error");
    }
    document.getElementById("newTodo").value = '';
    ipcRenderer.send('addTodo', newTodo);
  });
}

// 处理注销
const logoutButton = document.querySelector("#logout");
if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    ipcRenderer.send('logout');
  });
}

// 封装待办事项列表的创建和插入的函数
function createTodoElement(todo) {
  const li = document.createElement('li');
  li.className = 'list-group-item';

  const taskSpan = document.createElement('span');
  taskSpan.textContent = 'Task: ';
  taskSpan.style.color = '#007bff';
  taskSpan.style.fontWeight = 'bold';
  li.appendChild(taskSpan);

  const todoContent = document.createElement('span');
  todoContent.textContent = todo.content;
  todoContent.className = 'todo-content';
  li.appendChild(todoContent);

  // 闹钟图标按钮
  const alarmIcon = document.createElement('button');
  alarmIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 16 16">
  <!-- 时钟外圈 -->
  <circle cx="8" cy="8" r="7" stroke="currentColor" fill="white" />
  <!-- 时钟钟面 -->
  <circle cx="8" cy="8" r="6" stroke="currentColor" fill="lightgray" />
  <!-- 时钟小时指针 -->
  <line x1="8" y1="8" x2="8" y2="5" stroke="currentColor" stroke-width="1" />
  <!-- 时钟分钟指针 -->
  <line x1="8" y1="8" x2="11" y2="8" stroke="currentColor" stroke-width="1" />
  <!-- 时钟中心 -->
  <circle cx="8" cy="8" r="0.5" fill="currentColor" />
  <!-- 闹钟上部 -->
  <rect x="5" y="3" width="6" height="2" fill="currentColor" />
  <!-- 闹钟铃铛1 -->
  <path d="M 5 3 Q 4 1, 3 3" fill="currentColor"/>
  <!-- 闹钟铃铛2 -->
  <path d="M 11 3 Q 12 1, 13 3" fill="currentColor"/>
</svg>
`;
  alarmIcon.className = 'btn btn-link reminder-icon';
  const labelText = document.createElement('span');
  labelText.textContent = '设置提醒';
  labelText.className = 'reminder-label'; // 可以添加自定义的样式类名来调整样式

  // 将图标按钮和文字标签包装在一个容器<div>中
  const iconContainer = document.createElement('div');
  iconContainer.className = 'icon-container'; // 可以添加自定义的样式类名来调整样式
  iconContainer.appendChild(alarmIcon);
  iconContainer.appendChild(labelText);

  alarmIcon.addEventListener('click', async () => {
    const result = await Swal.fire({
      title: '设置提醒时间',
      html: `
        <label for="reminderTime">选择提醒时间:</label>
        <input type="datetime-local" id="reminderTime" name="reminderTime" class="swal2-input reminder-select">
      `,
      showCancelButton: true,
      confirmButtonText: '确认',
      cancelButtonText: '取消'
    });

    // 如果用户点击了确认按钮
    if (result.isConfirmed) {
      // 从弹窗中获取输入元素，并从中获取值
      const reminderTime = document.getElementById('reminderTime').value;

      if (reminderTime) {
        // 将 reminderTime 发送到主进程，以便添加提醒
        ipcRenderer.send('setReminder', { todoId: todo.id, reminderTime });
        const formattedTime = moment(reminderTime).format('YYYY-MM-DD HH:mm');
        Swal.fire({
          title: '提醒已设置',
          html: `你的提醒已经设置在 <span style="color: red; font-weight: bold;">${formattedTime}</span>。`,
          icon: 'success'
        });
      }
    }
  });

  li.appendChild(iconContainer);

  const todoStatus = document.createElement('p');
  todoStatus.textContent = `状态: ${todo.status}`;
  todoStatus.className = `todo-status status-${todo.status}`;
  li.appendChild(todoStatus);

  const todoCreatedTime = document.createElement('p');
  todoCreatedTime.textContent = `创建时间: ${moment(todo.created_time).format('YYYY-MM-DD HH:mm:ss')}`;
  todoCreatedTime.className = 'todo-created-time';
  li.appendChild(todoCreatedTime);

  if (todo.completed_time) {
    const todoCompletedTime = document.createElement('p');
    todoCompletedTime.textContent = `完成时间: ${moment(todo.completed_time).format('YYYY-MM-DD HH:mm:ss')}`;
    li.appendChild(todoCompletedTime);
  }

  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Delete';
  deleteButton.className = 'btn btn-danger btn-sm';
  deleteButton.addEventListener('click', async () => {
    const shouldDelete = await Swal.fire({
      title: '确认删除',
      text: '删除后不可恢复，确认删除吗？',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: '确定！',
      cancelButtonText: '取消'
    });

    if (shouldDelete.isConfirmed) {
      ipcRenderer.send('deleteTodo', todo.id);
    }
  });
  li.appendChild(deleteButton);

  if (todo.status !== 'completed') {
    const completeButton = document.createElement('button');
    completeButton.textContent = '标记为完成';
    completeButton.className = 'btn btn-success btn-sm';
    completeButton.addEventListener('click', () => {
      ipcRenderer.send('completeTodo', todo.id);
    });
    li.appendChild(completeButton);
  }
  // 根据 todo 的状态更新计数
  if (todo.status === 'completed') {
    completedCount++;
  } else {
    uncompletedCount++;
  }

  return li;
}

// 在回调函数之前定义计数变量
let completedCount = 0;
let uncompletedCount = 0;
// 监听从主进程发来的待办事项列表
ipcRenderer.on('todos', (event, todos) => {
  const todoList = document.querySelector("#todoList");
  todoList.innerHTML = '';

  // 初始化计数
  completedCount = 0;
  uncompletedCount = 0;

  todos.forEach(todo => {
    const li = createTodoElement(todo);
    todoList.appendChild(li);
  });
  // 在 UI 中更新计数
  const completedCountElement = document.querySelector("#completedCount");
  const uncompletedCountElement = document.querySelector("#uncompletedCount");
  completedCountElement.textContent = `已完成：${completedCount} 条`;
  uncompletedCountElement.textContent = `未完成：${uncompletedCount} 条`;
});

// 处理用户搜索
const searchTodo = document.querySelector("#searchTodo");
if (searchTodo) {
  searchTodo.addEventListener("keyup", (event) => {
    const searchQuery = event.target.value;
    if (searchQuery) {
      ipcRenderer.send('searchTodos', searchQuery);
    } else {
      document.querySelector("#searchResults").innerHTML = '';
      // When the search box is cleared, show all todos again
      ipcRenderer.send('getTodos');
    }
  });
}

// 处理从主进程发送过来的搜索结果
ipcRenderer.on('searchResults', (event, todos) => {
  const resultsList = document.querySelector("#searchResults");
  const todoList = document.querySelector("#todoList");

  if (todos.length > 0) {
    todoList.style.display = 'none';
    resultsList.style.display = 'block';
    resultsList.innerHTML = '';

    todos.forEach(todo => {
      const li = createTodoElement(todo);
      resultsList.appendChild(li);
    });
  } else {
    resultsList.style.display = 'none';
    todoList.style.display = 'block';
  }
});

document.addEventListener('DOMContentLoaded', (event) => {
  const searchTodo = document.querySelector("#searchTodo");
  // 在用户清空搜索框时，我们需要再次显示所有的待办事项
  searchTodo.addEventListener("keyup", (event) => {
    const searchQuery = event.target.value;
    if (!searchQuery) {
      const resultsList = document.querySelector("#searchResults");
      const todoList = document.querySelector("#todoList");
      resultsList.style.display = 'none'; // Hide the search results
      todoList.style.display = 'block'; // Show the original todo list
      ipcRenderer.send('getTodos');
    }
  });
});

// 监听从主进程发来的用户名
ipcRenderer.on('username', (event, username) => {
  const usernameSpan = document.querySelector("#username");
  usernameSpan.textContent = username;
});

// 使用通用函数来简化代码
handleIpcEvent('addTodo', '添加', '待办事项添加成功');
handleIpcEvent('deleteTodo', '删除', '删除成功');
handleIpcEvent('completeTodo', '完成', '恭喜你，完成啦👻');
handleIpcEvent('login', '登录', '登录成功', () => ipcRenderer.send('loadPage', 'todos.html'));
handleIpcEvent('register', '注册', '注册成功', () => ipcRenderer.send('loadPage', 'login.html'));
handleIpcEvent('resetPassword', '密码重置', '密码重置成功', () => ipcRenderer.send('loadPage', 'login.html'));