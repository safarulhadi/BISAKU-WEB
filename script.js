const STORAGE_KEY = "bisaku_transaksi";
const BUDGET_KEY = "bisaku_anggaran";
const THEME_KEY = "bisaku_tema";

let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let budgets = JSON.parse(localStorage.getItem(BUDGET_KEY) || "{}");
let toastTimer;

const $ = (id) => document.getElementById(id);
const rupiah = (value) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(value || 0);
const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
};
const currentMonth = () => todayISO().slice(0,7);
const formatDate = (value) => new Date(value + "T00:00:00").toLocaleDateString("id-ID", {
  day: "2-digit", month: "short", year: "numeric"
});
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[char]));

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}
function saveBudgets() {
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function monthTransactions(month) {
  return transactions.filter(item => item.date.startsWith(month));
}
function totals(items) {
  return items.reduce((result, item) => {
    if (item.type === "pemasukan") result.income += item.amount;
    else result.expense += item.amount;
    result.balance = result.income - result.expense;
    return result;
  }, { income: 0, expense: 0, balance: 0 });
}
function sortedTransactions(items) {
  return [...items].sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
function renderSummary() {
  const total = totals(transactions);
  $("totalSaldo").textContent = rupiah(total.balance);
  $("totalPemasukan").textContent = rupiah(total.income);
  $("totalPengeluaran").textContent = rupiah(total.expense);
}
function typeBadge(type) {
  return `<span class="type-badge ${type === "pemasukan" ? "income" : "expense"}">${type === "pemasukan" ? "Pemasukan" : "Pengeluaran"}</span>`;
}
function renderRecent() {
  const items = sortedTransactions(transactions).slice(0,5);
  $("recentTransactions").innerHTML = items.map(item => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td>${escapeHTML(item.description)}</td>
      <td>${escapeHTML(item.category)}</td>
      <td>${typeBadge(item.type)}</td>
      <td class="align-right ${item.type === "pemasukan" ? "amount-income" : "amount-expense"}">${item.type === "pemasukan" ? "+" : "−"} ${rupiah(item.amount)}</td>
    </tr>`).join("");
  $("recentEmpty").classList.toggle("hidden", items.length > 0);
}
function renderTransactionTable() {
  const query = $("searchInput").value.trim().toLowerCase();
  const type = $("typeFilter").value;
  const category = $("categoryFilter").value;
  const month = $("monthFilter").value;
  const filtered = sortedTransactions(transactions).filter(item => {
    const matchesQuery = `${item.description} ${item.category}`.toLowerCase().includes(query);
    return matchesQuery && (!type || item.type === type) &&
      (!category || item.category === category) && (!month || item.date.startsWith(month));
  });
  $("allTransactions").innerHTML = filtered.map((item,index) => `
    <tr>
      <td>${index+1}</td><td>${formatDate(item.date)}</td>
      <td>${escapeHTML(item.description)}</td><td>${escapeHTML(item.category)}</td>
      <td>${typeBadge(item.type)}</td>
      <td class="align-right ${item.type === "pemasukan" ? "amount-income" : "amount-expense"}">${item.type === "pemasukan" ? "+" : "−"} ${rupiah(item.amount)}</td>
      <td><div class="action-cell"><button class="action-btn" data-action="edit" data-id="${item.id}">Edit</button><button class="action-btn delete" data-action="delete" data-id="${item.id}">Hapus</button></div></td>
    </tr>`).join("");
  $("transactionEmpty").classList.toggle("hidden", filtered.length > 0);
  $("transactionCount").textContent = `${filtered.length} dari ${transactions.length} transaksi`;
}
function populateCategoryFilter() {
  const select = $("categoryFilter");
  const selected = select.value;
  const categories = [...new Set(transactions.map(item => item.category))].sort();
  select.innerHTML = '<option value="">Semua kategori</option>' +
    categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("");
  select.value = categories.includes(selected) ? selected : "";
}
function renderChart() {
  const canvas = $("cashflowChart");
  const month = $("chartMonth").value || currentMonth();
  const data = monthTransactions(month);
  const monthTotal = totals(data);
  const hasData = data.length > 0;
  $("chartEmpty").classList.toggle("hidden", hasData);
  canvas.classList.toggle("hidden", !hasData);
  if (!hasData) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.clientWidth;
  const height = 225;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,width,height);

  const padding = {top:18,right:12,bottom:32,left:48};
  const chartW = width-padding.left-padding.right;
  const chartH = height-padding.top-padding.bottom;
  const maxValue = Math.max(monthTotal.income,monthTotal.expense,1);
  const topValue = Math.ceil(maxValue/4)*4 || 4;
  const styles = getComputedStyle(document.body);
  const muted = styles.getPropertyValue("--muted").trim() || "#7b8798";
  const line = styles.getPropertyValue("--line").trim() || "#e9edf3";
  ctx.font = "10px DM Sans, Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for(let i=0;i<=4;i++){
    const y = padding.top + chartH-(i/4)*chartH;
    ctx.strokeStyle = line; ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(padding.left,y);ctx.lineTo(width-padding.right,y);ctx.stroke();
    ctx.fillStyle=muted;
    ctx.fillText(i===0?"0":compactNumber(topValue*i/4),padding.left-9,y);
  }
  const days = new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
  const groupW = chartW/days;
  const barW = Math.max(2,Math.min(10,groupW*.28));
  const daily = Array.from({length:days},()=>({income:0,expense:0}));
  data.forEach(item=>{
    const day=Number(item.date.slice(8,10))-1;
    daily[day][item.type==="pemasukan"?"income":"expense"]+=item.amount;
  });
  daily.forEach((item,index)=>{
    const center=padding.left+index*groupW+groupW/2;
    const incomeH=item.income/topValue*chartH;
    const expenseH=item.expense/topValue*chartH;
    ctx.fillStyle="#20b486";
    ctx.fillRect(center-barW-1,padding.top+chartH-incomeH,barW,incomeH);
    ctx.fillStyle="#f0787d";
    ctx.fillRect(center+1,padding.top+chartH-expenseH,barW,expenseH);
  });
  ctx.fillStyle=muted;ctx.textAlign="center";ctx.textBaseline="top";
  [1,Math.ceil(days/4),Math.ceil(days/2),Math.ceil(days*3/4),days].forEach(day=>{
    const x=padding.left+(day-.5)*groupW;
    ctx.fillText(String(day),x,height-padding.bottom+10);
  });
}
function compactNumber(value) {
  if(value>=1000000)return (value/1000000).toFixed(value%1000000===0?0:1)+" jt";
  if(value>=1000)return (value/1000).toFixed(value%1000===0?0:1)+" rb";
  return String(Math.round(value));
}
function renderBudgetMini() {
  const month=currentMonth(), limit=Number(budgets[month]||0), spent=totals(monthTransactions(month)).expense;
  const remaining=limit-spent, percent=limit?Math.round(spent/limit*100):0;
  $("budgetMiniAmount").innerHTML=`${rupiah(spent)} <span>/ ${rupiah(limit)}</span>`;
  $("budgetMiniBar").style.width=`${Math.min(percent,100)}%`;
  $("budgetMiniBar").className="progress-fill"+(percent>=100?" danger":percent>=80?" warning":"");
  $("budgetMiniText").textContent=limit?`${percent}% anggaran telah digunakan.`:"Tetapkan anggaran bulananmu.";
  $("budgetMiniRemaining").textContent=rupiah(remaining);
}
function renderBudgetPage() {
  const month=$("budgetMonth").value||currentMonth();
  const limit=Number(budgets[month]||0), spent=totals(monthTransactions(month)).expense;
  const remaining=limit-spent, percent=limit?Math.round(spent/limit*100):0;
  $("budgetStatusMonth").textContent=new Date(month+"-01T00:00:00").toLocaleDateString("id-ID",{month:"long",year:"numeric"});
  $("budgetSpent").textContent=rupiah(spent);
  $("budgetLimit").textContent=rupiah(limit);
  $("budgetRemaining").textContent=rupiah(remaining);
  $("budgetPercent").textContent=limit?percent+"%":"0%";
  $("budgetProgress").style.width=`${Math.min(percent,100)}%`;
  $("budgetProgress").className="progress-fill"+(percent>=100?" danger":percent>=80?" warning":"");
  const pill=$("budgetStatusPill"), warning=$("budgetWarning");
  warning.classList.add("hidden");
  if(!limit){pill.textContent="Belum diatur";pill.className="status-pill";warning.textContent="Masukkan batas pengeluaran untuk mulai memantau anggaran.";warning.classList.remove("hidden");}
  else if(percent>=100){pill.textContent="Melebihi batas";pill.className="status-pill over";warning.textContent=`Pengeluaran sudah melewati batas anggaran sebesar ${rupiah(Math.abs(remaining))}.`;warning.classList.remove("hidden");}
  else if(percent>=80){pill.textContent="Hampir habis";pill.className="status-pill warning";warning.textContent="Pengeluaran sudah mencapai minimal 80% dari anggaran.";warning.classList.remove("hidden");}
  else{pill.textContent="Terkendali";pill.className="status-pill safe";}
  $("budgetAmount").value=limit||"";
}
function renderReport() {
  const month=$("reportMonth").value||currentMonth();
  const items=sortedTransactions(monthTransactions(month));
  const total=totals(items);
  $("reportIncome").textContent=rupiah(total.income);
  $("reportExpense").textContent=rupiah(total.expense);
  $("reportBalance").textContent=rupiah(total.balance);
  $("reportText").textContent=items.length
    ? `Pada periode ${new Date(month+"-01T00:00:00").toLocaleDateString("id-ID",{month:"long",year:"numeric"})}, terdapat ${items.length} transaksi dengan total pemasukan ${rupiah(total.income)} dan pengeluaran ${rupiah(total.expense)}. Selisih pemasukan dan pengeluaran adalah ${rupiah(total.balance)}.`
    : "Belum ada transaksi pada periode ini. Tambahkan transaksi agar laporan dapat ditampilkan.";
  $("reportTransactions").innerHTML=items.map(item=>`<tr><td>${formatDate(item.date)}</td><td>${escapeHTML(item.description)}</td><td>${escapeHTML(item.category)}</td><td>${typeBadge(item.type)}</td><td class="align-right ${item.type==="pemasukan"?"amount-income":"amount-expense"}">${item.type==="pemasukan"?"+":"−"} ${rupiah(item.amount)}</td></tr>`).join("");
  $("reportEmpty").classList.toggle("hidden",items.length>0);
}
function renderAll() {
  renderSummary();renderRecent();renderTransactionTable();renderChart();renderBudgetMini();renderBudgetPage();renderReport();
}
function openModal(item=null) {
  $("transactionForm").reset();
  $("editId").value=item?item.id:"";
  $("modalTitle").textContent=item?"Edit transaksi":"Tambah transaksi";
  
  $("tanggal").setAttribute("max", todayISO());

  if(item){
    $("jenis").value=item.type;$("keterangan").value=item.description;
    $("kategori").value=item.category;$("nominal").value=item.amount;$("tanggal").value=item.date;
  }else{$("tanggal").value=todayISO();}
  $("transactionModal").classList.remove("hidden");
  $("jenis").focus();
}
function closeModal() {$("transactionModal").classList.add("hidden");}

function handleTransactionSubmit(event) {
  event.preventDefault();
  const id=$("editId").value;
  const type=$("jenis").value, description=$("keterangan").value.trim();
  const category=$("kategori").value, date=$("tanggal").value;
  
  const nominalStr = $("nominal").value;
  const amount = Number(nominalStr);
  const isStrictNumeric = /^\d+$/.test(nominalStr);
  
  if(!type||!description||!category||!date||!isStrictNumeric||!Number.isSafeInteger(amount)||amount<=0){
    showToast("Periksa kembali data transaksi. Nominal harus murni angka bulat.");
    return;
  }
  
  if (date > todayISO()) {
    showToast("Tanggal transaksi tidak boleh melebihi hari ini.");
    return;
  }

  const record={id:id||`${Date.now()}-${Math.random().toString(16).slice(2)}`,type,description,category,amount,date};
  if(id){transactions=transactions.map(item=>item.id===id?record:item);showToast("Transaksi berhasil diperbarui.");}
  else{transactions.push(record);showToast("Transaksi berhasil ditambahkan.");}
  saveTransactions();closeModal();renderAll();
}

function handleTableAction(event) {
  const button=event.target.closest("button[data-action]");
  if(!button)return;
  const item=transactions.find(entry=>entry.id===button.dataset.id);
  if(!item)return;
  if(button.dataset.action==="edit")openModal(item);
  if(button.dataset.action==="delete"&&confirm(`Hapus transaksi "${item.description}"?`)){
    transactions=transactions.filter(entry=>entry.id!==item.id);
    saveTransactions();renderAll();showToast("Transaksi berhasil dihapus.");
  }
}
function exportCSV() {
  const month=$("reportMonth").value||currentMonth();
  const items=sortedTransactions(monthTransactions(month));
  if(!items.length){showToast("Tidak ada data untuk diekspor.");return;}
  const rows=[["Tanggal","Keterangan","Kategori","Jenis","Nominal"],
    ...items.map(item=>[item.date,item.description,item.category,item.type,item.amount])];
  const csv=rows.map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=`laporan-bisaku-${month}.csv`;
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  showToast("Laporan CSV berhasil diunduh.");
}
function navigate(page) {
  document.querySelectorAll(".page").forEach(section=>section.classList.toggle("active",section.id===`page-${page}`));
  document.querySelectorAll(".nav-link").forEach(link=>link.classList.toggle("active",link.dataset.page===page));
  const titles={dashboard:"Dashboard",transaksi:"Transaksi",anggaran:"Anggaran",laporan:"Laporan"};
  $("pageTitle").textContent=titles[page]||"Dashboard";
  $("sidebar").classList.remove("open");
  if(page==="transaksi"){populateCategoryFilter();renderTransactionTable();}
  if(page==="anggaran")renderBudgetPage();
  if(page==="laporan")renderReport();
  if(page==="dashboard"){renderChart();renderBudgetMini();}
}
function initTheme() {
  const saved=localStorage.getItem(THEME_KEY);
  if(saved==="dark")document.body.classList.add("dark");
  $("themeToggle").textContent=document.body.classList.contains("dark")?"☀":"☾";
}
function toggleTheme() {
  document.body.classList.toggle("dark");
  const dark=document.body.classList.contains("dark");
  localStorage.setItem(THEME_KEY,dark?"dark":"light");
  $("themeToggle").textContent=dark?"☀":"☾";
  renderChart();
}

document.querySelectorAll(".nav-link").forEach(link=>link.addEventListener("click",event=>{
  event.preventDefault();navigate(link.dataset.page);history.replaceState(null,"",`#${link.dataset.page}`);
}));
$("quickAdd").addEventListener("click",()=>openModal());
$("addTransactionBtn").addEventListener("click",()=>openModal());
$("closeModal").addEventListener("click",closeModal);
$("cancelModal").addEventListener("click",closeModal);
$("transactionModal").addEventListener("click",event=>{if(event.target===$("transactionModal"))closeModal();});
$("transactionForm").addEventListener("submit",handleTransactionSubmit);
$("allTransactions").addEventListener("click",handleTableAction);
["searchInput","typeFilter","categoryFilter","monthFilter"].forEach(id=>$(id).addEventListener(id==="searchInput"?"input":"change",renderTransactionTable));
$("resetFilter").addEventListener("click",()=>{$("searchInput").value="";$("typeFilter").value="";$("categoryFilter").value="";$("monthFilter").value="";renderTransactionTable();});
$("chartMonth").addEventListener("change",renderChart);
$("budgetMonth").addEventListener("change",renderBudgetPage);

$("budgetForm").addEventListener("submit",event=>{
  event.preventDefault();
  const month=$("budgetMonth").value;
  const amountStr = $("budgetAmount").value;
  const amount = Number(amountStr);
  const isStrictNumeric = /^\d+$/.test(amountStr);

  if(!month||!isStrictNumeric||!Number.isSafeInteger(amount)||amount<=0){
    showToast("Masukkan nominal anggaran yang valid (murni angka).");
    return;
  }
  budgets[month]=amount;saveBudgets();renderAll();showToast("Anggaran berhasil disimpan.");
});

$("reportMonth").addEventListener("change",renderReport);
$("exportCsv").addEventListener("click",exportCSV);
$("themeToggle").addEventListener("click",toggleTheme);
$("menuToggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
window.addEventListener("resize",()=>{if($("page-dashboard").classList.contains("active"))renderChart();});
window.addEventListener("keydown",event=>{if(event.key==="Escape")closeModal();});

document.addEventListener("click", (event) => {
  const sidebar = $("sidebar");
  const menuToggle = $("menuToggle");
  if (window.innerWidth <= 720 && sidebar.classList.contains("open")) {
    if (!sidebar.contains(event.target) && !menuToggle.contains(event.target)) {
      sidebar.classList.remove("open");
    }
  }
});

$("todayLabel").textContent=new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
$("chartMonth").value=currentMonth();
$("budgetMonth").value=currentMonth();
$("reportMonth").value=currentMonth();
initTheme();
populateCategoryFilter();
renderAll();
const initialPage=location.hash.replace("#","");
if(["dashboard","transaksi","anggaran","laporan"].includes(initialPage))navigate(initialPage);