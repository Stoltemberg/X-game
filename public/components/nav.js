function createNavbar() {
    const nav = document.createElement('nav');
    nav.className = "bg-gray-800 border-b border-gray-700 mb-8";
    nav.innerHTML = `
        <div class="container mx-auto px-4">
            <div class="flex items-center justify-between h-16">
                <!-- Logo -->
                <a href="/" class="flex items-center gap-2">
                    <span class="text-2xl">🎮</span>
                    <span class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        GameHub
                    </span>
                </a>

                <!-- Links -->
                <div class="hidden md:flex items-center space-x-4">
                    <a href="/" class="text-gray-300 hover:text-white px-3 py-2 rounded-md transition ${window.location.pathname === '/' ? 'bg-gray-700 text-white' : ''}">
                        Home
                    </a>
                    <a href="/tictactoe.html" class="text-gray-300 hover:text-white px-3 py-2 rounded-md transition ${window.location.pathname.includes('tictactoe') ? 'bg-gray-700 text-white' : ''}">
                        Tic-Tac-Toe
                    </a>
                    <a href="/chess.html" class="text-gray-300 hover:text-white px-3 py-2 rounded-md transition ${window.location.pathname.includes('chess') ? 'bg-gray-700 text-white' : ''}">
                        Chess
                    </a>
                    <a href="/battleship.html" class="text-gray-300 hover:text-white px-3 py-2 rounded-md transition ${window.location.pathname.includes('battleship') ? 'bg-gray-700 text-white' : ''}">
                        Battleship
                    </a>
                </div>

                <!-- Mobile Menu Button (Optional) -->
                <div class="md:hidden">
                    <button class="text-gray-300 hover:text-white">
                        ☰
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.prepend(nav);
}

document.addEventListener('DOMContentLoaded', createNavbar);
