
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export enum Category {
  RENTAL = 'Aluguel',
  CLEANING = 'Limpeza',
  MAINTENANCE = 'Manutenção',
  UTILITIES = 'Contas (Luz/Água)',
  TAXES = 'Impostos/Condomínio',
  OTHERS = 'Outros'
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  category: Category;
  amount: number;
  description: string;
  guestName?: string;
  isPaid: boolean;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  occupancyRate: number;
}
