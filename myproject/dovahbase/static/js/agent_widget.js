(function () {
    "use strict";

    const WELCOME_TEXT = "可以问我站内电影、漫画、剧集、骑行等数据，也可以继续追问上一轮内容。";
    const GUEST_TEXT = "欢迎了解 Site Assistant。登录后可以提问，并使用仅属于你的历史对话。";
    const WIDGET_STATE_KEY = "dovahlore:agent-widget:v1";

    function safeJson(response) {
        return response.json().catch(() => ({}));
    }

    function initAgentChat(root) {
        const mode = root.dataset.mode;
        const isAuthenticated = root.dataset.authenticated === "true";
        const messagesNode = root.querySelector("[data-agent-messages]");
        const form = root.querySelector("[data-agent-form]");
        const input = root.querySelector("[data-agent-input]");
        const sendButton = root.querySelector("[data-agent-send]");
        const clearButton = root.querySelector("[data-agent-clear]");
        const toggleButton = root.querySelector("[data-agent-toggle]");
        const turnCountNode = root.querySelector("[data-agent-turn-count]");
        const csrfToken = root.querySelector("[name=csrfmiddlewaretoken]").value;

        if (window.marked) {
            marked.setOptions({breaks: true});
        }

        function headers() {
            return {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
            };
        }

        function updateTurnCount(value) {
            const count = Number.isFinite(Number(value)) ? Number(value) : 0;
            turnCountNode.textContent = String(Math.min(20, Math.max(0, count)));
        }

        function scrollToLatest() {
            messagesNode.scrollTop = messagesNode.scrollHeight;
        }

        function addMessage(role, content, options) {
            const node = document.createElement("div");
            node.className = `agent-chat-message ${role}`;
            if (options && options.typing) {
                node.classList.add("agent-chat-typing");
            }

            if (role === "assistant" && window.marked && window.DOMPurify) {
                node.innerHTML = DOMPurify.sanitize(marked.parse(content || ""));
            } else {
                node.textContent = content || "";
            }

            messagesNode.appendChild(node);
            scrollToLatest();
            return node;
        }

        function renderAssistant(node, markdownText) {
            if (window.marked && window.DOMPurify) {
                node.innerHTML = DOMPurify.sanitize(marked.parse(markdownText || ""));
            } else {
                node.textContent = markdownText || "";
            }
        }

        function showWelcome() {
            messagesNode.innerHTML = "";
            addMessage("system", WELCOME_TEXT);
        }

        function setBusy(isBusy) {
            sendButton.disabled = isBusy;
            clearButton.disabled = isBusy;
            input.disabled = isBusy;
        }

        function showGuestPreview() {
            messagesNode.innerHTML = "";
            addMessage("system", GUEST_TEXT);
            sendButton.disabled = true;
            clearButton.disabled = true;
            input.disabled = true;
        }

        async function loadHistory() {
            messagesNode.innerHTML = "";
            addMessage("system", "正在载入 Redis 对话记录…");

            try {
                const response = await fetch("/s/agent/history", {
                    method: "GET",
                    cache: "no-store",
                    headers: {"Accept": "application/json"},
                });
                const data = await safeJson(response);
                if (!response.ok) {
                    throw new Error(data.error || "无法读取对话记录");
                }

                messagesNode.innerHTML = "";
                const history = Array.isArray(data.messages) ? data.messages : [];
                if (!history.length) {
                    showWelcome();
                } else {
                    history.forEach((item) => {
                        if (item.role === "user" || item.role === "assistant") {
                            addMessage(item.role, item.content || "");
                        }
                    });
                }
                updateTurnCount(data.turn_count);
            } catch (error) {
                messagesNode.innerHTML = "";
                addMessage("system", error.message || "Redis 对话记录载入失败");
            }
        }

        clearButton.addEventListener("click", async () => {
            if (!isAuthenticated) return;
            // Deliberately clear immediately: no confirmation dialog.
            clearButton.disabled = true;
            try {
                const response = await fetch("/s/agent/clear", {
                    method: "POST",
                    headers: headers(),
                    body: "{}",
                });
                const data = await safeJson(response);
                if (!response.ok) {
                    throw new Error(data.error || "清除失败");
                }
                showWelcome();
                addMessage("system", data.message || "已清空对话记忆。");
                updateTurnCount(0);
            } catch (error) {
                addMessage("system", error.message || "清除失败，请稍后重试。");
            } finally {
                clearButton.disabled = false;
            }
        });

        async function submitMessage() {
            if (!isAuthenticated) {
                return;
            }
            const text = input.value.trim();
            if (!text || sendButton.disabled) {
                return;
            }

            addMessage("user", text);
            input.value = "";
            setBusy(true);

            const assistantNode = addMessage("assistant", "", {typing: true});
            let accumulatedText = "";

            try {
                const response = await fetch("/s/agent/chat", {
                    method: "POST",
                    headers: headers(),
                    body: JSON.stringify({message: text}),
                });

                if (!response.ok) {
                    const data = await safeJson(response);
                    throw new Error(data.error || `请求失败（${response.status}）`);
                }

                if (!response.body) {
                    throw new Error("当前浏览器不支持流式响应");
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let buffer = "";

                function handleEvent(rawEvent) {
                    const line = rawEvent.split("\n").find((item) => item.startsWith("data: "));
                    if (!line) return;

                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.content) {
                            accumulatedText += data.content;
                            renderAssistant(assistantNode, accumulatedText);
                            scrollToLatest();
                        }
                        if (data.error) {
                            accumulatedText = data.error;
                            renderAssistant(assistantNode, accumulatedText);
                        }
                        if (data.turn_count !== undefined) {
                            updateTurnCount(data.turn_count);
                        }
                    } catch (error) {
                        console.error("SSE 解析失败", error);
                    }
                }

                while (true) {
                    const result = await reader.read();
                    if (result.done) break;
                    buffer += decoder.decode(result.value, {stream: true});
                    const events = buffer.split("\n\n");
                    buffer = events.pop();
                    events.forEach(handleEvent);
                }
                buffer += decoder.decode();
                if (buffer.trim()) handleEvent(buffer);

                if (!accumulatedText) {
                    renderAssistant(assistantNode, "已完成，但没有返回文本。");
                }
            } catch (error) {
                renderAssistant(assistantNode, error.message || "网络请求失败，请稍后重试。");
            } finally {
                assistantNode.classList.remove("agent-chat-typing");
                setBusy(false);
                input.focus();
                scrollToLatest();
            }
        }

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            submitMessage();
        });

        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitMessage();
            }
        });

        if (mode === "widget") {
            initWidgetMovement(root, toggleButton);
        }

        if (isAuthenticated) {
            loadHistory();
        } else {
            showGuestPreview();
        }
    }

    function readWidgetState() {
        try {
            return JSON.parse(localStorage.getItem(WIDGET_STATE_KEY) || "{}");
        } catch (_) {
            return {};
        }
    }

    function writeWidgetState(nextState) {
        try {
            const state = Object.assign(readWidgetState(), nextState);
            localStorage.setItem(WIDGET_STATE_KEY, JSON.stringify(state));
        } catch (_) {
            // Position persistence is optional; chat remains usable without it.
        }
    }

    function initWidgetMovement(root, toggleButton) {
        const handle = root.querySelector("[data-agent-drag-handle]");
        const resizeHandle = root.querySelector("[data-agent-resize]");
        const saved = readWidgetState();
        let drag = null;
        let resize = null;
        let lastTrailAt = 0;

        function syncCustomCursor(event) {
            const cursor = document.querySelector(".custom-cursor");
            const cursorDot = document.querySelector(".cursor-dot");
            const mouseGlow = document.querySelector(".mouse-glow");
            const transform = `translate3d(calc(${event.clientX}px - 50%), calc(${event.clientY}px - 50%), 0)`;
            if (cursor) cursor.style.transform = transform;
            if (cursorDot) cursorDot.style.transform = transform;
            if (mouseGlow) mouseGlow.style.transform = transform;
        }

        function addDragTrail(x, y) {
            const now = performance.now();
            if (now - lastTrailAt < 22) return;
            lastTrailAt = now;

            const dot = document.createElement("span");
            dot.className = "agent-drag-trail-dot";
            dot.style.left = `${x}px`;
            dot.style.top = `${y}px`;
            document.body.appendChild(dot);
            dot.addEventListener("animationend", () => dot.remove(), {once: true});
        }

        function clampPosition(left, top) {
            const rect = root.getBoundingClientRect();
            const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
            const maxTop = Math.max(76, window.innerHeight - rect.height - 8);
            return {
                left: Math.min(Math.max(8, left), maxLeft),
                top: Math.min(Math.max(76, top), maxTop),
            };
        }

        function clampSize(width, height, left, top) {
            const maxWidth = Math.max(280, Math.min(720, window.innerWidth - left - 8));
            const maxHeight = Math.max(340, Math.min(780, window.innerHeight - top - 8));
            const minWidth = Math.min(330, maxWidth);
            const minHeight = Math.min(420, maxHeight);
            return {
                width: Math.min(Math.max(minWidth, width), maxWidth),
                height: Math.min(Math.max(minHeight, height), maxHeight),
            };
        }

        function applySizeFromState(state) {
            if (!Number.isFinite(state.width) || !Number.isFinite(state.height)) return;
            const rect = root.getBoundingClientRect();
            const size = clampSize(state.width, state.height, rect.left, rect.top);
            root.style.width = `${size.width}px`;
            root.style.height = `${size.height}px`;
        }

        function applySavedPosition() {
            if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
                const position = clampPosition(saved.left, saved.top);
                root.style.left = `${position.left}px`;
                root.style.top = `${position.top}px`;
                root.style.right = "auto";
                root.style.bottom = "auto";
            }
        }

        function setCollapsed(collapsed, initializing) {
            if (collapsed && !initializing && !root.classList.contains("is-collapsed")) {
                const rect = root.getBoundingClientRect();
                writeWidgetState({width: rect.width, height: rect.height});
            }

            root.classList.toggle("is-collapsed", collapsed);
            toggleButton.textContent = collapsed ? "+" : "−";
            toggleButton.setAttribute("aria-expanded", String(!collapsed));
            writeWidgetState({collapsed: collapsed});

            requestAnimationFrame(() => {
                if (!collapsed) {
                    applySizeFromState(readWidgetState());
                }
                const rect = root.getBoundingClientRect();
                if (root.style.left) {
                    const position = clampPosition(rect.left, rect.top);
                    root.style.left = `${position.left}px`;
                    root.style.top = `${position.top}px`;
                    writeWidgetState(position);
                }
            });
        }

        setCollapsed(Boolean(saved.collapsed), true);
        requestAnimationFrame(() => {
            if (!saved.collapsed) applySizeFromState(saved);
            applySavedPosition();
        });

        toggleButton.addEventListener("click", (event) => {
            event.stopPropagation();
            setCollapsed(!root.classList.contains("is-collapsed"));
        });

        handle.addEventListener("pointerdown", (event) => {
            if (event.target.closest("button")) return;

            const rect = root.getBoundingClientRect();
            root.style.left = `${rect.left}px`;
            root.style.top = `${rect.top}px`;
            root.style.right = "auto";
            root.style.bottom = "auto";
            drag = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                left: rect.left,
                top: rect.top,
                moved: false,
            };
            root.classList.add("is-dragging");
            syncCustomCursor(event);
            handle.setPointerCapture(event.pointerId);
            event.preventDefault();
        });

        handle.addEventListener("pointermove", (event) => {
            if (!drag || drag.pointerId !== event.pointerId) return;
            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;

            const position = clampPosition(drag.left + dx, drag.top + dy);
            root.style.left = `${position.left}px`;
            root.style.top = `${position.top}px`;
            syncCustomCursor(event);
            if (drag.moved) addDragTrail(event.clientX, event.clientY);
        });

        function finishDrag(event) {
            if (!drag || drag.pointerId !== event.pointerId) return;
            const wasMoved = drag.moved;
            drag = null;
            root.classList.remove("is-dragging");
            syncCustomCursor(event);
            const rect = root.getBoundingClientRect();
            writeWidgetState({left: rect.left, top: rect.top});
            if (!wasMoved) {
                setCollapsed(!root.classList.contains("is-collapsed"));
            }
        }

        handle.addEventListener("pointerup", finishDrag);
        handle.addEventListener("pointercancel", finishDrag);

        resizeHandle.addEventListener("pointerdown", (event) => {
            if (root.classList.contains("is-collapsed")) return;

            const rect = root.getBoundingClientRect();
            root.style.left = `${rect.left}px`;
            root.style.top = `${rect.top}px`;
            root.style.right = "auto";
            root.style.bottom = "auto";
            resize = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top,
            };
            root.classList.add("is-resizing");
            resizeHandle.setPointerCapture(event.pointerId);
            syncCustomCursor(event);
            event.preventDefault();
            event.stopPropagation();
        });

        resizeHandle.addEventListener("pointermove", (event) => {
            if (!resize || resize.pointerId !== event.pointerId) return;
            const size = clampSize(
                resize.width + event.clientX - resize.startX,
                resize.height + event.clientY - resize.startY,
                resize.left,
                resize.top
            );
            root.style.width = `${size.width}px`;
            root.style.height = `${size.height}px`;
            syncCustomCursor(event);
            addDragTrail(event.clientX, event.clientY);
        });

        function finishResize(event) {
            if (!resize || resize.pointerId !== event.pointerId) return;
            resize = null;
            root.classList.remove("is-resizing");
            syncCustomCursor(event);
            const rect = root.getBoundingClientRect();
            writeWidgetState({
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            });
        }

        resizeHandle.addEventListener("pointerup", finishResize);
        resizeHandle.addEventListener("pointercancel", finishResize);

        window.addEventListener("resize", () => {
            if (!root.style.left) return;
            const rect = root.getBoundingClientRect();
            const position = clampPosition(rect.left, rect.top);
            const size = clampSize(rect.width, rect.height, position.left, position.top);
            root.style.left = `${position.left}px`;
            root.style.top = `${position.top}px`;
            root.style.width = `${size.width}px`;
            root.style.height = `${size.height}px`;
            writeWidgetState(Object.assign(position, size));
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("[data-agent-chat]").forEach(initAgentChat);
    });
})();
