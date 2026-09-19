import React, { createContext, useContext, ReactNode } from 'react';

// Define the shape of the context data
interface BudgetContextType {
  budgetId: string;
}

// Create the context with an undefined default value for strict type checking
const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

interface BudgetProviderProps {
  budgetId: string;
  children: ReactNode;
}

// Provider Component
export const BudgetProvider: React.FC<BudgetProviderProps> = ({ budgetId, children }) => {
  return (
    <BudgetContext.Provider value={{ budgetId }}>
      {children}
    </BudgetContext.Provider>
  );
};

// Custom hook for children to easily consume the budget ID
export const useBudget = (): BudgetContextType => {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
};
