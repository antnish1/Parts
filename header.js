function Header(user) {
  return `
    <div class="flex items-center justify-between p-4 border-b border-gray-700">
      <div>
        <p class="text-sm text-gray-400">Branch</p>
        <p class="font-semibold text-yellow-1400">${user.branch}</p>
      </div>

      <button onclick="logout()" class="text-sm text-red-800">
        Logout
      </button>
    </div>
  `;
}
