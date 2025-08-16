const i18n = {
    en: {
        title: "To-Do List",
        todoTitle: "To-Do",
        completedTitle: "Completed",
        placeholder: "New task...",
        addBtn: "Add",
        editBtn: "Edit",
        undoBtn: "Undo",
        deleteBtn: "Delete",
        deleteConfirm: "Are you sure you want to permanently delete this task?"
    },
    pt: {
        title: "Lista de Tarefas",
        todoTitle: "A Fazer",
        completedTitle: "Concluídas",
        placeholder: "Nova tarefa...",
        addBtn: "Adicionar",
        editBtn: "Editar",
        undoBtn: "Desfazer",
        deleteBtn: "Apagar",
        deleteConfirm: "Tem certeza que deseja apagar permanentemente esta tarefa?"
    },
    ja: {
        title: "TODOリスト",
        todoTitle: "未完了",
        completedTitle: "完了済み",
        placeholder: "新しいタスク...",
        addBtn: "追加",
        editBtn: "編集",
        undoBtn: "元に戻す",
        deleteBtn: "削除",
        deleteConfirm: "このタスクを完全に削除してもよろしいですか？"
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const langSwitcher = document.getElementById('lang-switcher');
    const themeSwitcher = document.getElementById('theme-switcher');
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const taskList = document.getElementById('task-list');
    const completedList = document.getElementById('completed-list');

    let currentLanguage = localStorage.getItem('app_lang') || 'en';
    let currentTheme = localStorage.getItem('app_theme') || 'dark';
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
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (lang[key]) {
                el.title = lang[key];
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
        const lang = i18n[currentLanguage] || i18n.en;

        tasks.todo.forEach((task, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex align-items-center';
            li.dataset.index = index;
            li.innerHTML = `
                <input class="form-check-input me-2" type="checkbox">
                <span>${task}</span>
                <div class="task-actions">
                    <button class="btn-edit" title="${lang.editBtn}"><i class="fas fa-pencil-alt"></i></button>
                </div>
            `;
            taskList.appendChild(li);
        });

        tasks.completed.forEach((task, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item completed d-flex align-items-center';
            li.dataset.index = index;
            li.innerHTML = `
                <span>${task}</span>
                <div class="task-actions">
                    <button class="btn-undo" title="${lang.undoBtn}"><i class="fas fa-undo"></i></button>
                    <button class="btn-delete" title="${lang.deleteBtn}"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
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

    taskList.addEventListener('click', (e) => {
        const target = e.target;
        const li = target.closest('li');
        if (!li) return;

        const index = li.dataset.index;

        if (target.type === 'checkbox') {
            const completedTask = tasks.todo.splice(index, 1)[0];
            tasks.completed.push(completedTask);
            saveTasks();
            renderTasks();
        } else if (target.closest('.btn-edit')) {
            const span = li.querySelector('span');
            const currentText = span.innerText;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentText;
            input.className = 'form-control form-control-sm';

            span.replaceWith(input);
            input.focus();

            const saveEdit = () => {
                const newText = input.value.trim();
                if (newText) {
                    tasks.todo[index] = newText;
                }
                input.replaceWith(span);
                saveTasks();
                renderTasks();
            };

            input.addEventListener('blur', saveEdit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    saveEdit();
                } else if (e.key === 'Escape') {
                    input.replaceWith(span);
                    renderTasks();
                }
            });
        }
    });

    completedList.addEventListener('click', (e) => {
        const target = e.target;
        const li = target.closest('li');
        if (!li) return;

        const index = li.dataset.index;

        if (target.closest('.btn-undo')) {
            const taskToUndo = tasks.completed.splice(index, 1)[0];
            tasks.todo.push(taskToUndo);
            saveTasks();
            renderTasks();
        } else if (target.closest('.btn-delete')) {
            const lang = i18n[currentLanguage] || i18n.en;
            if (confirm(lang.deleteConfirm)) {
                tasks.completed.splice(index, 1);
                saveTasks();
                renderTasks();
            }
        }
    });

    langSwitcher.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        localStorage.setItem('app_lang', currentLanguage);
        applyI18n();
        renderTasks(); // Re-render tasks to update button titles
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
