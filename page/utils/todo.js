const i18n = {
    en: {
        title: "To-Do List",
        todoTitle: "To-Do",
        completedTitle: "Completed",
        placeholder: "New task...",
        addBtn: "Add"
    },
    pt: {
        title: "Lista de Tarefas",
        todoTitle: "A Fazer",
        completedTitle: "Concluídas",
        placeholder: "Nova tarefa...",
        addBtn: "Adicionar"
    },
    ja: {
        title: "TODOリスト",
        todoTitle: "未完了",
        completedTitle: "完了済み",
        placeholder: "新しいタスク...",
        addBtn: "追加"
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const langSwitcher = document.getElementById('lang-switcher');
    const themeSwitcher = document.getElementById('theme-switcher');
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const taskList = document.getElementById('task-list');
    const completedList = document.getElementById('completed-list');

    let currentLanguage = localStorage.getItem('todo_lang') || 'en';
    let currentTheme = localStorage.getItem('todo_theme') || 'dark';
    let tasks = JSON.parse(localStorage.getItem('todo_tasks')) || { todo: [], completed: [] };

    const applyI18n = () => {
        const lang = i18n[currentLanguage] || i18n.en;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (lang[key]) {
                el.innerText = lang[key];
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (lang[key]) {
                el.placeholder = lang[key];
            }
        });
        document.title = lang.title;
    };

    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = themeSwitcher.querySelector('i');
        if (theme === 'light') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
        localStorage.setItem('todo_theme', theme);
    };

    const saveTasks = () => {
        localStorage.setItem('todo_tasks', JSON.stringify(tasks));
    };

    const renderTasks = () => {
        taskList.innerHTML = '';
        completedList.innerHTML = '';

        tasks.todo.forEach((task, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex align-items-center';
            li.innerHTML = `
                <input class="form-check-input me-2" type="checkbox" data-index="${index}">
                <span>${task}</span>
            `;
            taskList.appendChild(li);
        });

        tasks.completed.forEach((task) => {
            const li = document.createElement('li');
            li.className = 'list-group-item completed';
            li.innerText = task;
            completedList.appendChild(li);
        });
    };

    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newTask = taskInput.value.trim();
        if (newTask) {
            tasks.todo.push(newTask);
            taskInput.value = '';
            saveTasks();
            renderTasks();
        }
    });

    taskList.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const index = e.target.dataset.index;
            const completedTask = tasks.todo.splice(index, 1)[0];
            tasks.completed.push(completedTask);
            saveTasks();
            renderTasks();
        }
    });

    langSwitcher.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        localStorage.setItem('todo_lang', currentLanguage);
        applyI18n();
    });

    themeSwitcher.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(currentTheme);
    });

    // Initial setup
    langSwitcher.value = currentLanguage;
    applyI18n();
    applyTheme(currentTheme);
    renderTasks();
});
