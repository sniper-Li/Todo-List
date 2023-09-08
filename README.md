# todoList

## 项目介绍

一个基于Electron的ToDoList应用程序，包含用户注册、登录、找回密码功能和一套完整的待办事项管理系统，包括添加任务、设置提醒、标记任务状态和任务搜索功能。本应用采用了bootstap进行前端响应式布局，seetalert2实现友好美观的用户提示。

## 

### 后端技术

- Node.js

### 前端技术

- BootStrap
- SweetAlert2
- Electron

## 环境搭建

### 开发工具

- Visual Studio Code

### 数据库

- MySQL 

### 搭建步骤

1. 切换到项目目录，安装项目所有需要的依赖

   `npm i`

2. 填写配置文件.env中的内容

   | key                                        | Value                                        | 注释                                                    |
   | ------------------------------------------ | -------------------------------------------- | ------------------------------------------------------- |
   | <span style="color:red">EMAIL_USE</span>   | <span style="color:blue">qq邮箱</span>       | <span style="color:skyblue">用于邮件发送的qq邮箱</span> |
   | <span style="color:red">EMAIL_PASS</span>  | <span style="color:blue">邮箱的安全码</span> | <span style="color:skyblue">邮箱的安全码</span>         |
   | <span style="color:red">DB_HOST</span>     | <span style="color:blue">数据库地址</span>   | <span style="color:skyblue">数据库地址</span>           |
   | <span style="color:red">DB_PORT</span>     | <span style="color:blue">数据库端口</span>   | <span style="color:skyblue">数据库端口</span>           |
   | <span style="color:red">DB_USER</span>     | <span style="color:blue">数据库用户名</span> | <span style="color:skyblue">数据库用户名</span>         |
   | <span style="color:red">DB_PASSWORD</span> | <span style="color:blue">数据库密码</span>   | <span style="color:skyblue">数据库密码</span>           |
   | <span style="color:red">DB_NAME</span>     | <span style="color:blue">数据库名</span>     | <span style="color:skyblue">数据库名</span>             |

3. 运行项目

   `electron .`

## 项目演示

- #### 登录
<img width="995" alt="login" src="https://github.com/sniper-Li/Todo-List/assets/88961888/8ad9733d-01b8-41fc-a078-f4fcafd6da9f">

- #### 注册

  <img width="997" alt="register" src="https://github.com/sniper-Li/Todo-List/assets/88961888/4f4189cf-3f96-4d98-87fc-a20727078d0b">


- #### 重置密码

  <img width="995" alt="reset password" src="https://github.com/sniper-Li/Todo-List/assets/88961888/97361919-29da-4f82-9b6b-02f8d0a5b682">


- #### 应用首页

  <img width="995" alt="index" src="https://github.com/sniper-Li/Todo-List/assets/88961888/5d8f0741-2d7b-42fc-8588-af09188de85e">


- #### 设置提醒时间

  <img width="993" alt="setReminder" src="https://github.com/sniper-Li/Todo-List/assets/88961888/218cc753-3635-4247-b569-9442d6d3211b">


***

## 渲染进程分析

### 1. 代码复用和模块化

- **通用验证函数 (`validateInput`)**
  - 减少代码重复
  - 提高代码的一致性和可维护性

- **通用事件监听函数 (`handleIpcEvent`)**
  - 简化了多个事件监听的代码
  - 避免了代码重复和潜在的错误

- **待办事项元素创建函数 (`createTodoElement`)**
  - 允许在多处重用相同的代码来创建待办事项元素
  - 提高了代码的复用性和一致性

### 2. 算法和逻辑

- **验证码发送逻辑**
  - 在`sendVerificationCode`函数中实现了巧妙的验证码发送和计时逻辑
  - 使用循环来控制验证码的发送和计时
  - 利用`setInterval`和`clearInterval`实现倒计时功能

- **动态SVG生成**
  - 动态生成SVG元素来创建一个视觉友好的倒计时器
  - 结合了计时逻辑和动态DOM操作

### 3. 结构和组织

- **事件监听和处理**
  - 将事件监听和处理逻辑组织在一起，使代码结构更清晰和有逻辑
  - 提高了代码的可读性和可维护性

- **分离关注点**
  - 将不同的功能和逻辑（如登录、注册、重置密码等）分离到不同的代码块中
  - 有助于更容易地理解和维护代码

### 4. 错误处理和用户体验

- **输入验证和错误处理**
  - 包含多处输入验证和错误处理逻辑
  - 避免程序错误，提供更好的用户体验

- **Swal库的应用**
  - 显示友好的提示和确认对话框
  - 增强了用户体验

### 5. 代码注释和文档

- 包含大量的注释，有助于理解和维护代码
- 提供了良好的代码文档，方便后续的代码维护和升级

### 6. 安全性

- **密码哈希**
  - 使用bcrypt进行密码哈希
  - 保护用户的密码安全

### 7. 时间和日期处理

- 使用Moment.js进行时间和日期的处理和格式化
- 方便地显示和管理时间和日期

---

## 主进程代码分析

### 1. 项目结构和模块化

- **模块化的代码结构**
  - 通过将功能分割成不同的模块和函数，代码结构更清晰，易于维护和扩展。
  - 使用了多个外部库，如`bcrypt`, `mysql2`, `moment`, `nodemailer`, 和`node-schedule`，充分利用了Node.js的生态系统。

- **环境变量的使用**
  - 使用`dotenv`库来管理环境变量，保护敏感信息并提高代码的灵活性。

### 2. 数据库交互

- **连接池的使用**
  - 使用`mysql2/promise`库创建连接池，提高数据库交互的效率和性能。
  - 事务的使用确保了数据的一致性和完整性。

- **异步编程和错误处理**
  - 使用`async/await`语法进行异步编程，使代码更清晰和可读。
  - 详细的错误处理和日志记录，有助于诊断和解决问题。

### 3. 用户体验

- **动态页面加载**
  - 使用`BrowserWindow`的`loadFile`方法动态加载页面，提高了用户体验。
  - 利用`ready-to-show`事件来优化窗口的显示时间，避免白屏现象。

- **邮件通知功能**
  - 利用`nodemailer`库实现邮件发送功能，包括验证码发送和待办事项提醒。
  - 使用`node-schedule`库来实现待办事项的定时提醒功能。

### 4. 安全性

- **密码加密**
  - 使用`bcrypt`库来加密用户密码，增强了系统的安全性。

### 5. 代码质量

- **代码复用**
  - 通过创建通用的函数和模块，减少了代码重复，提高了代码的复用性。

- **代码注释**
  - 代码包含了详细的注释，有助于理解代码的功能和结构。

### 6. 时间管理

- **时间处理**
  - 使用`moment`库来处理和格式化时间，简化了时间相关的代码。

---

综上，本项目充分体现了现代前端开发的多项技术和最佳实践，展示了一个结构清晰、功能丰富和高度模块化的Electron项目。它不仅涵盖了渲染进程脚本的良好结构和合理算法，还展示了主进程脚本的高度可复用性和用户友好的设计。 该项目充分利用了Node.js的异步编程特性和丰富的生态系统，集成了多个外部库来提升功能性和安全性，从而构建了一个高效、安全和用户友好的桌面应用。它是一个展示了结构良好、算法合理和高度可复用性的优秀项目。（自我吹捧哈哈哈哈😄～～～～）

## 许可证

MIT License 

## 联系方式

- 作者: Li Nanxi
- 电子邮件: linanxi914@gmail.com
