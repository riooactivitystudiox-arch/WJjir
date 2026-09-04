// WaliJomok Members - 11 people, all blank for now
const members = [
    { nama: "andes_lawal", display: "Andes Lawal", role: "Admin", verified: true },
    { nama: "geo_jmk48", display: "geo jmk48", role: "Admin", verified: true },
    { nama: "ridho_athalla", display: "Ridho Athalla", role: "Admin", verified: true },
    { nama: "dimas_dewa", display: "Dimas Dewa", role: "Member", verified: false },
    { nama: "atha_rasyid", display: "Atha Rasyid XF", role: "Member", verified: false },
    { nama: "doni_king", display: "Doni King", role: "Member", verified: false },
    { nama: "findra", display: "findra", role: "Member", verified: false },
    { nama: "iqbal_jir", display: "iqbal jir", role: "Member", verified: false },
    { nama: "rasyid", display: "rasyid", role: "Member", verified: false },
    { nama: "rifki_biji", display: "Rifki Biji", role: "Member", verified: false },
    { nama: "new_member", display: "New Member", role: "Member", verified: false }
];

function renderMembers() {
    const grid = document.getElementById('memberGrid');
    if (!grid) return;

    grid.innerHTML = '';
    members.forEach((m, i) => {
        const a = document.createElement('a');
        a.href = `../member/${m.nama}.html`;
        a.className = 'profile-item';
        a.setAttribute('data-role', m.role);
        a.style.animationDelay = `${0.04 + i * 0.04}s`;

        const badge = m.verified ? `
            <span class="verified-badge" title="Verified">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>` : '';

        a.innerHTML = `
            <div class="avatar">
                <img src="../images/blank.png" alt="${m.display}">
            </div>
            <div class="member-row">
                <span class="member-name">${m.display}</span>
                ${badge}
            </div>
            <div class="member-role">${m.role}</div>
        `;
        grid.appendChild(a);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('memberGrid')) renderMembers();
});
