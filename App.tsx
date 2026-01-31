
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  AlertCircle,
  Info,
  HelpCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  AreaChart,
  Area,
  XAxis, 
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
  const [explanation, setExplanation] = useState<{
    title: string; 
    text?: string;
    type?: 'text' | 'list';
    data?: { label: string; value: string; color: string; percent?: string }[];
  } | null>(null);
  
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
    const sorted = [...filteredTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const points: Record<string, number> = {};
    sorted.forEach(t => {
        const dateKey = new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const val = t.type === TransactionType.INCOME ? t.amount : -t.amount;
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
    filteredTransactions.forEach(t => {
      const date = new Date(t.date);
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
    if (Object.keys(months).length === 0) return [];
    return Object.entries(months).map(([name, data]) => ({ name, ...data }));
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

  const COLORS = ['#0891B2', '#2DD4BF', '#10B981', '#F43F5E', '#6366F1', '#F59E0B'];

  const getPeriodLabel = () => {
    switch(timeRange) {
      case 'monthly': return 'Este Mês';
      case 'semiannual': return 'Este Semestre';
      case 'annual': return 'Este Ano';
      case 'all': return 'Tudo';
    }
  };

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
  };

  const tabVariants = {
    enter: { x: 20, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 }
  };

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen flex flex-col relative pb-24 shadow-2xl overflow-hidden font-sans">
      
      {/* Modals with AnimatePresence */}
      <AnimatePresence>
        {showReport && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-600" /> Relatório
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {explanation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" 
            onClick={() => setExplanation(null)}
          >
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-t-[2rem] sm:rounded-3xl shadow-2xl p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-cyan-100 p-3 rounded-2xl">
                  <Info className="w-6 h-6 text-cyan-600" />
                </div>
                <button onClick={() => setExplanation(null)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">{explanation.title}</h3>
              
              {explanation.text && (
                <p className="text-slate-500 leading-relaxed text-sm mb-4">
                  {explanation.text}
                </p>
              )}

              {explanation.type === 'list' && explanation.data && (
                <div className="space-y-3 mt-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {explanation.data.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shadow-sm ring-2 ring-white" style={{ backgroundColor: item.color }}></div>
                        <div>
                          <p className="font-semibold text-slate-700">{item.label}</p>
                          {item.percent && <p className="text-[10px] text-slate-400 font-medium">{item.percent} do total</p>}
                        </div>
                      </div>
                      <span className="font-bold text-slate-800 bg-white px-2 py-1 rounded-md shadow-sm">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}

              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setExplanation(null)}
                className="w-full mt-6 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Entendi
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="p-6 bg-gradient-to-br from-[#0891B2] to-[#155E75] text-white shadow-lg rounded-b-[2.5rem] relative overflow-hidden z-30">
        
        {/* Animated Decorative Circles */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-400/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"
        />

        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <motion.img 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              src="/logo.png" alt="Logo" className="w-12 h-12 object-contain bg-white/20 rounded-xl p-1 shadow-lg backdrop-blur-sm border border-white/30" 
            />
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h1 className="text-2xl font-bold tracking-tight text-white">Porto Finanças</h1>
              <p className="text-cyan-100 opacity-90 text-sm">Gestão de Flat</p>
            </motion.div>
          </div>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowReport(true)}
            className="bg-white/20 p-2.5 rounded-xl shadow-lg backdrop-blur-md border border-white/10 hover:bg-white/30 transition-colors"
          >
            <FileText className="w-6 h-6 text-cyan-50" />
          </motion.button>
        </div>

        {/* Time Filter Tabs */}
        <div className="flex p-1 bg-black/20 backdrop-blur-md rounded-2xl mb-6 relative z-10">
          {(['monthly', 'semiannual', 'annual'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-300 relative ${
                timeRange === range ? 'text-cyan-800' : 'text-cyan-100 hover:bg-white/10'
              }`}
            >
              {timeRange === range && (
                <motion.div
                  layoutId="tab-highlight"
                  className="absolute inset-0 bg-white rounded-xl shadow-md"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{range === 'monthly' ? 'Mês' : range === 'semiannual' ? 'Semestre' : 'Ano'}</span>
            </button>
          ))}
        </div>

        {/* Balance Card */}
        <motion.div 
          key={timeRange} // Re-animate on time change
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100 }}
          className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-xl relative z-10"
        >
          <p className="text-cyan-50 text-xs font-medium mb-1 uppercase tracking-wider">Saldo • {getPeriodLabel()}</p>
          <motion.h2 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="text-4xl font-extrabold mb-4 tracking-tight"
          >
            R$ {summary.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </motion.h2>
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
        </motion.div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Extended Metrics Cards */}
              <div className="grid grid-cols-2 gap-4">
                 <motion.div 
                    variants={itemVariants}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setExplanation({
                      title: "Detalhamento da Margem",
                      type: 'list',
                      text: "Cálculo da eficiência do seu aluguel no período:",
                      data: [
                        { label: 'Receita Total', value: `R$ ${summary.income.toLocaleString('pt-BR')}`, color: '#10B981' },
                        { label: 'Despesas Totais', value: `R$ ${summary.expenses.toLocaleString('pt-BR')}`, color: '#F43F5E' },
                        { label: 'Lucro Líquido', value: `R$ ${summary.balance.toLocaleString('pt-BR')}`, color: '#0891B2' }
                      ]
                    })}
                    className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden cursor-help"
                 >
                    <div className="absolute right-0 top-0 p-4 opacity-10">
                      <Percent className="w-16 h-16 text-cyan-600" />
                    </div>
                    <div className="absolute top-3 right-3 opacity-20">
                       <HelpCircle className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Margem de Lucro</p>
                      <h3 className={`text-2xl font-extrabold ${summary.margin >= 50 ? 'text-emerald-500' : summary.margin > 0 ? 'text-cyan-600' : 'text-rose-500'}`}>
                        {summary.margin.toFixed(0)}%
                      </h3>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(0, Math.min(100, summary.margin))}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${summary.margin >= 50 ? 'bg-emerald-500' : summary.margin > 0 ? 'bg-cyan-500' : 'bg-rose-500'}`} 
                      />
                    </div>
                 </motion.div>

                 <motion.div 
                   variants={itemVariants}
                   whileHover={{ scale: 1.02 }}
                   whileTap={{ scale: 0.98 }}
                   onClick={() => setExplanation({
                      title: "Diagnóstico Financeiro",
                      type: 'list',
                      text: "Indicadores de saúde do seu negócio:",
                      data: [
                        { label: 'Margem Atual', value: `${summary.margin.toFixed(1)}%`, color: summary.margin > 30 ? '#10B981' : '#F59E0B' },
                        { label: 'Status', value: summary.margin > 30 ? 'Ótima' : summary.margin > 0 ? 'Atenção' : 'Crítica', color: '#64748b' },
                        { label: 'Balanço', value: summary.balance > 0 ? 'Positivo' : 'Negativo', color: summary.balance > 0 ? '#10B981' : '#F43F5E' }
                      ]
                   })}
                   className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between cursor-help relative"
                 >
                    <div className="absolute top-3 right-3 opacity-20">
                       <HelpCircle className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Saúde Financeira</p>
                      <div className="flex items-center gap-2">
                         {summary.margin > 30 ? (
                           <span className="text-emerald-500 font-bold flex items-center gap-1 text-sm"><Target className="w-4 h-4" /> Ótima</span>
                         ) : summary.margin > 0 ? (
                           <span className="text-amber-500 font-bold flex items-center gap-1 text-sm"><AlertCircle className="w-4 h-4" /> Atenção</span>
                         ) : (
                           <span className="text-rose-500 font-bold flex items-center gap-1 text-sm"><AlertCircle className="w-4 h-4" /> Crítica</span>
                         )}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 leading-tight">
                      {summary.margin > 30 
                        ? "Seu flat está gerando excelente retorno." 
                        : "Revise custos para melhorar a margem."}
                    </p>
                 </motion.div>
              </div>

              {/* Insights Button */}
              <motion.div 
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchAiInsights}
                className="group bg-gradient-to-r from-cyan-600 to-teal-600 p-[1px] rounded-3xl shadow-lg cursor-pointer transition-all"
              >
                <div className="bg-white p-4 rounded-[23px] flex items-center justify-between h-full group-hover:bg-opacity-95 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="bg-cyan-100 p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                      <Briefcase className="w-6 h-6 text-cyan-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">Consultoria Estratégica</h3>
                      <p className="text-xs text-slate-500">Análise do {getPeriodLabel().toLowerCase()}</p>
                    </div>
                  </div>
                  <div className="bg-cyan-50 p-2 rounded-full">
                    <ChevronRight className="w-5 h-5 text-cyan-600" />
                  </div>
                </div>
              </motion.div>

              {/* AI Insight Result */}
              <AnimatePresence>
                {aiInsight && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-3xl border border-slate-200 relative shadow-sm">
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
                  </motion.div>
                )}
              </AnimatePresence>

              {isAnalyzing && (
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                  <div className="relative">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-14 h-14 border-4 border-cyan-100 rounded-full"
                    ></motion.div>
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="w-14 h-14 border-4 border-cyan-600 rounded-full border-t-transparent absolute top-0 left-0"
                    ></motion.div>
                  </div>
                  <p className="text-cyan-600 font-medium animate-pulse text-sm">Gerando relatório inteligente...</p>
                </div>
              )}

              {/* Evolution Area Chart */}
              <motion.div 
                variants={itemVariants}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  const startVal = balanceEvolutionData.length > 0 ? balanceEvolutionData[0].value : 0;
                  const endVal = balanceEvolutionData.length > 0 ? balanceEvolutionData[balanceEvolutionData.length - 1].value : 0;
                  const growth = endVal - startVal;
                  setExplanation({
                    title: "Evolução do Patrimônio",
                    type: 'list',
                    text: "Variação acumulada do seu saldo neste período:",
                    data: [
                      { label: 'Saldo Inicial', value: `R$ ${startVal.toLocaleString('pt-BR')}`, color: '#64748b' },
                      { label: 'Saldo Atual', value: `R$ ${endVal.toLocaleString('pt-BR')}`, color: '#0891B2' },
                      { label: 'Crescimento Real', value: `R$ ${growth.toLocaleString('pt-BR')}`, color: growth >= 0 ? '#10B981' : '#F43F5E' }
                    ]
                  });
                }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-help relative"
              >
                 <div className="absolute top-6 right-6 opacity-20">
                    <HelpCircle className="w-5 h-5 text-slate-400" />
                 </div>
                 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-600" /> Evolução Patrimonial
                 </h3>
                 <div className="h-48 w-full">
                   {balanceEvolutionData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={balanceEvolutionData}>
                          <defs>
                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0891B2" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#0891B2" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#0891B2" 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorBalance)" 
                            animationDuration={1500}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                   ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                        Sem dados suficientes.
                      </div>
                   )}
                 </div>
              </motion.div>

              {/* Row with Bar Chart and Categories */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Monthly Bar Chart */}
                <motion.div 
                  variants={itemVariants}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setExplanation({
                    title: "Resumo do Fluxo de Caixa",
                    type: 'list',
                    text: "Comparativo total de Entradas e Saídas do período:",
                    data: [
                      { label: 'Total Entradas', value: `R$ ${summary.income.toLocaleString('pt-BR')}`, color: '#0891B2' },
                      { label: 'Total Saídas', value: `R$ ${summary.expenses.toLocaleString('pt-BR')}`, color: '#F43F5E' },
                      { label: 'Saldo Final', value: `R$ ${summary.balance.toLocaleString('pt-BR')}`, color: summary.balance >= 0 ? '#10B981' : '#F43F5E' }
                    ]
                  })}
                  className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-help relative"
                >
                  <div className="absolute top-6 right-6 opacity-20">
                    <HelpCircle className="w-5 h-5 text-slate-400" />
                  </div>
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-cyan-600" /> Fluxo de Caixa
                  </h3>
                  <div className="h-48 w-full">
                    {monthlyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            cursor={{fill: '#f8fafc'}}
                          />
                          <Bar dataKey="income" fill="#0891B2" radius={[4, 4, 0, 0]} barSize={20} animationDuration={1500} />
                          <Bar dataKey="expense" fill="#F43F5E" radius={[4, 4, 0, 0]} barSize={20} animationDuration={1500} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                        Nenhum dado para exibir gráfico.
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Categories Pie */}
                <motion.div 
                  variants={itemVariants}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setExplanation({
                    title: "Detalhamento de Gastos",
                    type: 'list',
                    text: "Visualize exatamente para onde foi cada centavo neste período.",
                    data: chartData.map((item, index) => ({
                      label: item.name,
                      value: `R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                      color: COLORS[index % COLORS.length],
                      percent: summary.expenses > 0 ? `${((item.value / summary.expenses) * 100).toFixed(1)}%` : '0%'
                    }))
                  })}
                  className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col cursor-help relative"
                >
                  <div className="absolute top-6 right-6 opacity-20">
                    <HelpCircle className="w-5 h-5 text-slate-400" />
                  </div>
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-teal-600" /> Distribuição de Gastos
                  </h3>
                  <div className="h-48 flex items-center justify-center relative">
                     {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              innerRadius={65}
                              outerRadius={85}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                              animationDuration={1500}
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
                     ) : (
                      <p className="text-slate-400 text-sm">Adicione gastos para ver a distribuição.</p>
                     )}
                     {/* Center Text */}
                     {chartData.length > 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xs text-slate-400 font-medium">Total</span>
                          <span className="text-lg font-bold text-slate-700">R$ {summary.expenses.toLocaleString('pt-BR', { notation: 'compact' })}</span>
                        </div>
                     )}
                  </div>
                </motion.div>
              </div>

              {/* Top Expenses List */}
              {topExpenses.length > 0 && (
                <motion.div 
                  variants={itemVariants}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setExplanation({
                    title: "Ranking Completo de Gastos",
                    type: 'list',
                    text: "Detalhamento de todos os seus centros de custo:",
                    data: chartData.map((item, idx) => ({
                        label: `${idx + 1}º ${item.name}`,
                        value: `R$ ${item.value.toLocaleString('pt-BR')}`,
                        color: '#F43F5E',
                        percent: summary.expenses > 0 ? `${((item.value / summary.expenses) * 100).toFixed(1)}%` : '0%'
                    }))
                  })}
                  className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-help relative"
                >
                   <div className="absolute top-6 right-6 opacity-20">
                      <HelpCircle className="w-5 h-5 text-slate-400" />
                   </div>
                   <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-rose-500" /> Maiores Custos
                   </h3>
                   <div className="space-y-4">
                      {topExpenses.map((item, idx) => (
                        <div key={idx} className="relative">
                          <div className="flex justify-between text-sm mb-1 relative z-10">
                            <span className="font-medium text-slate-700">{item.name}</span>
                            <span className="font-bold text-slate-900">R$ {item.value.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${item.percent}%` }}
                              transition={{ duration: 1, delay: idx * 0.1 }}
                              className="h-full bg-rose-400 rounded-full" 
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 text-right">{item.percent.toFixed(1)}% dos gastos</p>
                        </div>
                      ))}
                   </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center mb-2 px-2">
                <h3 className="font-bold text-xl text-slate-800">Transações</h3>
                <div className="flex gap-2">
                  <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold">
                    {filteredTransactions.length} registros
                  </span>
                </div>
              </div>
              
              <AnimatePresence>
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map(t => (
                    <motion.div 
                      key={t.id} 
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      className="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-center justify-between group hover:shadow-md transition-shadow"
                    >
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
                        <motion.button 
                          whileTap={{ scale: 0.8 }}
                          onClick={() => deleteTransaction(t.id)} 
                          className="text-slate-300 hover:text-rose-500 transition-colors p-1 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-20 flex flex-col items-center"
                  >
                    <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                      <History className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-slate-600 font-bold">Nada por aqui</h3>
                    <p className="text-slate-400 text-sm mt-1 max-w-[200px]">Nenhuma transação encontrada para o filtro selecionado.</p>
                    <button onClick={() => setTimeRange('all')} className="mt-4 text-cyan-600 font-bold text-sm">
                      Ver todo o histórico
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Add Transaction Tab */}
          {activeTab === 'add' && (
            <motion.div 
              key="add"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white rounded-[2.5rem] p-8 shadow-lg border border-slate-100 relative overflow-hidden"
            >
               {/* Decorative */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

              <h3 className="text-2xl font-bold text-slate-800 mb-6 relative z-10">Novo Lançamento</h3>
              
              <form onSubmit={handleAddTransaction} className="space-y-6 relative z-10">
                <div className="grid grid-cols-2 gap-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setFormType(TransactionType.INCOME)}
                    className={`py-4 rounded-2xl font-bold transition-all duration-300 flex flex-col items-center gap-2 ${formType === TransactionType.INCOME ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-200 ring-4 ring-emerald-50 scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    <TrendingUp className="w-6 h-6" />
                    Receita
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setFormType(TransactionType.EXPENSE)}
                    className={`py-4 rounded-2xl font-bold transition-all duration-300 flex flex-col items-center gap-2 ${formType === TransactionType.EXPENSE ? 'bg-rose-500 text-white shadow-xl shadow-rose-200 ring-4 ring-rose-50 scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    <TrendingDown className="w-6 h-6" />
                    Despesa
                  </motion.button>
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

                  <AnimatePresence>
                    {formType === TransactionType.INCOME && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                      >
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Hóspede Principal</label>
                        <input 
                          type="text" 
                          value={formGuest}
                          onChange={(e) => setFormGuest(e.target.value)}
                          placeholder="Ex: Ana Souza"
                          className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 px-4 font-medium text-slate-800 focus:border-cyan-500 focus:bg-white outline-none"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

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

                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  className="w-full bg-slate-800 text-white py-5 rounded-2xl font-bold text-lg shadow-xl hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" />
                  Salvar Registro
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
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

        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab('add')}
          className="mx-2 bg-slate-800 text-white p-5 rounded-full shadow-2xl shadow-slate-300 -mt-12 border-4 border-white hover:bg-slate-700 group relative"
        >
          <PlusCircle className={`w-8 h-8 transition-transform duration-300 ${activeTab === 'add' ? 'rotate-45' : 'group-hover:rotate-90'}`} />
        </motion.button>

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
