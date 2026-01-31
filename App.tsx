import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieChartIcon,
  Bot,
  Briefcase,
  ChevronRight,
  Filter,
  Trash2,
  Calendar,
  X,
  FileText,
  Printer,
  CalendarDays,
  ArrowRight,
  Percent,
  Wallet,
  Target,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { Transaction, TransactionType, Category } from './types';
import { getFinancialInsights } from './services/geminiService';

type TimeRange = 'monthly' | 'semiannual' | 'annual' | 'all';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('porto_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'add'>('dashboard');
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  
  // Form State
  const [formType, setFormType] = useState<TransactionType>(TransactionType.INCOME);
  const [formCategory, setFormCategory] = useState<Category>(Category.RENTAL);
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDesc, setFormDesc] = useState('');
  const [formGuest, setFormGuest] = useState('');

  useEffect(() => {
    localStorage.setItem('porto_transactions', JSON.stringify(transactions));
  }, [transactions]);

  // Filter Logic
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      if (timeRange === 'all') return true;
      
      const isSameYear = tDate.getFullYear() === now.getFullYear();
      
      if (timeRange === 'monthly') {
        return isSameYear && tDate.getMonth() === now.getMonth();
      }
      if (timeRange === 'semiannual') {
        const currentSemester = now.getMonth() < 6 ? 0 : 1;
        const tSemester = tDate.getMonth() < 6 ? 0 : 1;
        return isSameYear && tSemester === currentSemester;
      }
      if (timeRange === 'annual') {
        return isSameYear;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, timeRange]);

  const summary = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const expenses = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
    const balance = income - expenses;
    const margin = income > 0 ? ((balance / income) * 100) : 0;
    
    return {
      income,
      expenses,
      balance,
      margin
    };
  }, [filteredTransactions]);

  const topExpenses = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE);
    const categories: Record<string, number> = {};
    expenses.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value, percent: summary.expenses > 0 ? (value / summary.expenses) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }, [filteredTransactions, summary.expenses]);

  const balanceEvolutionData = useMemo(() => {
    let currentBalance = 0;
    // We need chronological order for evolution
    const sorted = [...filteredTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Group by day to avoid too many points
    const points: Record<string, number> = {};
    sorted.forEach(t => {
        const dateKey = new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const val = t.type === TransactionType.INCOME ? t.amount : -t.amount;
        // This is a daily balance view, or accumulated? Let's do accumulated for "Wealth Growth"
        currentBalance += val;
        points[dateKey] = currentBalance;
    });

    return Object.entries(points).map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    const categories: Record<string, number> = {};
    filteredTransactions.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const monthlyData = useMemo(() => {
    const months: Record<string, { income: number; expense: number }> = {};
    // Show at least the last 6 months regardless of filter for the chart context, or just the filtered range?
    // Let's show the filtered range breakdown.
    filteredTransactions.forEach(t => {
      const date = new Date(t.date);
      const label = date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }); // Group by day for month view?
      
      // For Month view, let's group by week or day. For Annual, by month.
      let key = '';
      if (timeRange === 'monthly') {
        key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      } else {
        key = date.toLocaleDateString('pt-BR', { month: 'short' });
      }

      if (!months[key]) months[key] = { income: 0, expense: 0 };
      if (t.type === TransactionType.INCOME) months[key].income += t.amount;
      else months[key].expense += t.amount;
    });

    // Fallback for empty data to avoid crash
    if (Object.keys(months).length === 0) return [];

    return Object.entries(months)
      .map(([name, data]) => ({ name, ...data }));
  }, [filteredTransactions, timeRange]);

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAmount || parseFloat(formAmount) <= 0) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      type: formType,
      category: formCategory,
      amount: parseFloat(formAmount),
      date: formDate,
      description: formDesc,
      guestName: formType === TransactionType.INCOME ? formGuest : undefined,
      isPaid: true
    };

    setTransactions(prev => [newTransaction, ...prev]);
    resetForm();
    setActiveTab('dashboard');
  };

  const resetForm = () => {
    setFormAmount('');
    setFormDesc('');
    setFormGuest('');
    setFormCategory(Category.RENTAL);
  };

  const deleteTransaction = (id: string) => {
    if (confirm('Deseja realmente excluir este registro?')) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  const fetchAiInsights = async () => {
    setIsAnalyzing(true);
    const rangeLabels = {
      monthly: 'Mês Atual',
      semiannual: 'Semestre Atual',
      annual: 'Ano Atual',
      all: 'Todo o Período'
    };
    const insight = await getFinancialInsights(filteredTransactions, rangeLabels[timeRange]);
    setAiInsight(insight);
    setIsAnalyzing(false);
  };

  const handlePrint = () => {
    window.print();
  };

  // Paleta de cores personalizada - Tema Porto de Galinhas (Teal/Cyan)
  const COLORS = [
    '#0891B2', // Cyan 600
    '#2DD4BF', // Teal 400
    '#10B981', // Emerald 500
    '#F43F5E', // Rose 500
    '#6366F1', // Indigo 500
    '#F59E0B'  // Amber 500
  ];

  const getPeriodLabel = () => {
    switch(timeRange) {
      case 'monthly': return 'Este Mês';
      case 'semiannual': return 'Este Semestre';
      case 'annual': return 'Este Ano';
      case 'all': return 'Tudo';
    }
  };

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen flex flex-col relative pb-24 shadow-2xl overflow-hidden">
      
      {/* Report Modal */}
      {showReport && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-600" /> Relatório Financeiro
                </h2>
                <p className="text-xs text-slate-500 mt-1">{getPeriodLabel()} • Porto Finanças</p>
              </div>
              <button onClick={() => setShowReport(false)} className="bg-white p-2 rounded-full shadow-sm border border-slate-200 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 space-y-6 print-content">
              {/* Summary Block */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-bold uppercase mb-1">Receitas</p>
                  <p className="text-lg font-bold text-emerald-700">R$ {summary.income.toLocaleString('pt-BR')}</p>
                </div>
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                  <p className="text-xs text-rose-600 font-bold uppercase mb-1">Despesas</p>
                  <p className="text-lg font-bold text-rose-700">R$ {summary.expenses.toLocaleString('pt-BR')}</p>
                </div>
                <div className="p-4 bg-cyan-50 rounded-2xl border border-cyan-100">
                  <p className="text-xs text-cyan-600 font-bold uppercase mb-1">Saldo</p>
                  <p className="text-lg font-bold text-cyan-700">R$ {summary.balance.toLocaleString('pt-BR')}</p>
                </div>
              </div>

              {/* Categories */}
              <div>
                <h3 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wide border-b border-slate-100 pb-2">Detalhamento por Categoria</h3>
                <div className="space-y-3">
                  {chartData.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        {item.name}
                      </span>
                      <span className="font-medium text-slate-800">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>

               {/* Transactions List */}
               <div>
                <h3 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wide border-b border-slate-100 pb-2">Extrato do Período</h3>
                <div className="space-y-2">
                  {filteredTransactions.map(t => (
                    <div key={t.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{t.description || t.category}</p>
                        <p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString('pt-BR')} {t.guestName && `• ${t.guestName}`}</p>
                      </div>
                      <span className={`text-sm font-bold ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === TransactionType.INCOME ? '+' : '-'} {t.amount.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <button 
                onClick={handlePrint}
                className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-slate-700 transition-all active:scale-95"
              >
                <Printer className="w-5 h-5" /> Imprimir Relatório
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="p-6 bg-gradient-to-br from-[#0891B2] to-[#155E75] text-white shadow-lg rounded-b-[2.5rem] relative overflow-hidden">
        
        {/* Decorative Circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-400/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain bg-white/20 rounded-xl p-1 shadow-lg backdrop-blur-sm border border-white/30" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Porto Finanças</h1>
              <p className="text-cyan-100 opacity-90 text-sm">Gestão de Flat</p>
            </div>
          </div>
          <button 
            onClick={() => setShowReport(true)}
            className="bg-white/20 p-2.5 rounded-xl shadow-lg backdrop-blur-md border border-white/10 hover:bg-white/30 transition-colors"
          >
            <FileText className="w-6 h-6 text-cyan-50" />
          </button>
        </div>

        {/* Time Filter Tabs */}
        <div className="flex p-1 bg-black/20 backdrop-blur-md rounded-2xl mb-6 relative z-10">
          {(['monthly', 'semiannual', 'annual'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                timeRange === range 
                  ? 'bg-white text-cyan-800 shadow-md' 
                  : 'text-cyan-100 hover:bg-white/10'
              }`}
            >
              {range === 'monthly' ? 'Mês' : range === 'semiannual' ? 'Semestre' : 'Ano'}
            </button>
          ))}
        </div>

        {/* Balance Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-xl relative z-10">
          <p className="text-cyan-50 text-xs font-medium mb-1 uppercase tracking-wider">Saldo • {getPeriodLabel()}</p>
          <h2 className="text-4xl font-extrabold mb-4 tracking-tight">
            R$ {summary.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <div className="flex justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-400/20 p-1.5 rounded-lg border border-emerald-400/30">
                <TrendingUp className="w-4 h-4 text-emerald-300" />
              </div>
              <div>
                <p className="text-[10px] text-cyan-50 uppercase">Entradas</p>
                <p className="text-sm font-bold">R$ {summary.income.toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-rose-400/20 p-1.5 rounded-lg border border-rose-400/30">
                <TrendingDown className="w-4 h-4 text-rose-300" />
              </div>
              <div>
                <p className="text-[10px] text-cyan-50 uppercase">Saídas</p>
                <p className="text-sm font-bold">R$ {summary.expenses.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-6 overflow-y-auto">
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Insights Button */}
            <div 
              onClick={fetchAiInsights}
              className="group bg-gradient-to-r from-violet-600 to-indigo-600 p-[1px] rounded-3xl shadow-lg cursor-pointer active:scale-95 transition-all"
            >
              <div className="bg-white p-4 rounded-[23px] flex items-center justify-between h-full group-hover:bg-opacity-95 transition-all">
                <div className="flex items-center gap-4">
                  <div className="bg-violet-100 p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                    <Bot className="w-6 h-6 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Consultoria IA</h3>
                    <p className="text-xs text-slate-500">Análise do {getPeriodLabel().toLowerCase()}</p>
                  </div>
                </div>
                <div className="bg-violet-50 p-2 rounded-full">
                  <ChevronRight className="w-5 h-5 text-violet-600" />
                </div>
              </div>
            </div>

            {/* AI Insight Result */}
            {aiInsight && (
              <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-3xl border border-slate-200 relative animate-in zoom-in-95 duration-300 shadow-sm">
                <button 
                  onClick={() => setAiInsight(null)}
                  className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 mb-3">
                   <Bot className="w-5 h-5 text-cyan-600" />
                   <h4 className="text-slate-900 font-bold">Relatório do Consultor</h4>
                </div>
                <div className="prose prose-slate prose-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {aiInsight}
                </div>
              </div>
            )}

            {isAnalyzing && (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="relative">
                  <div className="w-14 h-14 border-4 border-cyan-100 rounded-full"></div>
                  <div className="w-14 h-14 border-4 border-cyan-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                </div>
                <p className="text-cyan-600 font-medium animate-pulse text-sm">Gerando relatório inteligente...</p>
              </div>
            )}

            {/* Categories Pie - Only show if there is data */}
            {filteredTransactions.length > 0 ? (
              <>
                 <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-teal-600" /> Despesas por Categoria
                  </h3>
                  <div className="h-56 flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          innerRadius={65}
                          outerRadius={85}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs text-slate-400 font-medium">Total Despesas</span>
                      <span className="text-lg font-bold text-slate-700">R$ {summary.expenses.toLocaleString('pt-BR', { notation: 'compact' })}</span>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {chartData.slice(0, 4).map((entry, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="truncate">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                <CalendarDays className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-medium text-sm">Sem dados neste período</p>
                <button onClick={() => setActiveTab('add')} className="mt-2 text-cyan-600 text-xs font-bold hover:underline">
                  Adicionar Transação
                </button>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center mb-2 px-2">
              <h3 className="font-bold text-xl text-slate-800">Transações</h3>
              <div className="flex gap-2">
                <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold">
                  {filteredTransactions.length} registros
                </span>
              </div>
            </div>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map(t => (
                <div key={t.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-center justify-between group hover:shadow-md transition-all active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {t.type === TransactionType.INCOME ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700 leading-tight text-sm">{t.description || t.category}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-500">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{t.category}</p>
                      </div>
                      {t.guestName && <p className="text-xs font-medium text-cyan-600 mt-1 flex items-center gap-1"><ArrowRight className="w-3 h-3" /> {t.guestName}</p>}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <span className={`font-bold text-base ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === TransactionType.INCOME ? '+' : '-'} {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </span>
                    <button onClick={() => deleteTransaction(t.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-1 hover:bg-rose-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 flex flex-col items-center">
                <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                  <History className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-slate-600 font-bold">Nada por aqui</h3>
                <p className="text-slate-400 text-sm mt-1 max-w-[200px]">Nenhuma transação encontrada para o filtro selecionado.</p>
                <button onClick={() => setTimeRange('all')} className="mt-4 text-cyan-600 font-bold text-sm">
                  Ver todo o histórico
                </button>
              </div>
            )}
          </div>
        )}

        {/* Add Transaction Tab */}
        {activeTab === 'add' && (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-lg border border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-500 relative overflow-hidden">
             {/* Decorative */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

            <h3 className="text-2xl font-bold text-slate-800 mb-6 relative z-10">Novo Lançamento</h3>
            
            <form onSubmit={handleAddTransaction} className="space-y-6 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormType(TransactionType.INCOME)}
                  className={`py-4 rounded-2xl font-bold transition-all duration-300 flex flex-col items-center gap-2 ${formType === TransactionType.INCOME ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-200 ring-4 ring-emerald-50 scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  <TrendingUp className="w-6 h-6" />
                  Receita
                </button>
                <button
                  type="button"
                  onClick={() => setFormType(TransactionType.EXPENSE)}
                  className={`py-4 rounded-2xl font-bold transition-all duration-300 flex flex-col items-center gap-2 ${formType === TransactionType.EXPENSE ? 'bg-rose-500 text-white shadow-xl shadow-rose-200 ring-4 ring-rose-50 scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  <TrendingDown className="w-6 h-6" />
                  Despesa
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Valor da Transação</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 group-focus-within:text-cyan-500 transition-colors">R$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 pl-12 pr-4 text-2xl font-bold text-slate-800 focus:border-cyan-500 focus:bg-white transition-all outline-none placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Data</label>
                    <div className="relative">
                      <input 
                        type="date" 
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-3 px-4 font-bold text-slate-600 focus:border-cyan-500 focus:bg-white outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Categoria</label>
                    <select 
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as Category)}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-3 px-4 font-bold text-slate-600 focus:border-cyan-500 focus:bg-white outline-none appearance-none text-sm"
                    >
                      {Object.values(Category).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {formType === TransactionType.INCOME && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Hóspede Principal</label>
                    <input 
                      type="text" 
                      value={formGuest}
                      onChange={(e) => setFormGuest(e.target.value)}
                      placeholder="Ex: Ana Souza"
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 px-4 font-medium text-slate-800 focus:border-cyan-500 focus:bg-white outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Observações</label>
                  <textarea 
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Detalhes opcionais..."
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 px-4 font-medium text-slate-800 focus:border-cyan-500 focus:bg-white outline-none h-24 resize-none"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-slate-800 text-white py-5 rounded-2xl font-bold text-lg shadow-xl hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-5 h-5" />
                Salvar Registro
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-6 left-4 right-4 bg-white/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 shadow-2xl p-2 flex items-center justify-between safe-bottom z-50 max-w-md mx-auto ring-1 ring-slate-100">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 flex flex-col items-center py-3 rounded-[2rem] transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-200' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <LayoutDashboard className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Painel</span>
        </button>

        <button 
          onClick={() => setActiveTab('add')}
          className="mx-2 bg-slate-800 text-white p-5 rounded-full shadow-2xl shadow-slate-300 -mt-12 active:scale-90 transition-all border-4 border-white hover:bg-slate-700 group"
        >
          <PlusCircle className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
        </button>

        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex flex-col items-center py-3 rounded-[2rem] transition-all duration-300 ${activeTab === 'history' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-200' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <History className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Extrato</span>
        </button>
      </nav>
    </div>
  );
}

export default App;