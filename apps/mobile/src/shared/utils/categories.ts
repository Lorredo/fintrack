import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const CATEGORY_ICONS: Record<string, IconName> = {
  'Food & Drinks': 'food',
  'Food & Dining': 'food',
  Transportation: 'car',
  Shopping: 'shopping',
  Entertainment: 'movie',
  'Bills & Utilities': 'file-document',
  Housing: 'home',
  Health: 'medical-bag',
  Education: 'school',
  Salary: 'cash',
  Freelance: 'laptop',
  Investment: 'chart-line',
  Groceries: 'cart',
  'SM Supermarket': 'cart',
  'Dining Out': 'silverware-fork-knife',
  'Coffee & Snacks': 'coffee',
  'Gas & Fuel': 'gas-station',
  'Public Transit': 'bus',
  'Online Shopping': 'basket',
  'Clothing & Apparel': 'tshirt-crew',
  'Streaming Services': 'television',
  'Mobile & Internet': 'cellphone',
  'Electric & Water': 'lightbulb',
  'Rent & Mortgage': 'home-city',
  'Medical & Dental': 'hospital-box',
  'Gym & Fitness': 'dumbbell',
  'Tuition & Books': 'book-open-page-variant',
  'Bonus & Commission': 'gift',
  'Side Hustle': 'briefcase',
  'Stocks & Dividends': 'trending-up',
  'Crypto & Digital': 'bitcoin',
};

export const CATEGORY_COLORS: Record<string, string> = {
  'Food & Drinks': '#F59E0B',
  'Food & Dining': '#F59E0B',
  Transportation: '#3B82F6',
  Shopping: '#EC4899',
  Entertainment: '#8B5CF6',
  'Bills & Utilities': '#EF4444',
  Housing: '#10B981',
  Health: '#06B6D4',
  Education: '#6366F1',
  Salary: '#22C55E',
  Freelance: '#14B8A6',
  Investment: '#84CC16',
  Groceries: '#F97316',
  'SM Supermarket': '#F97316',
  'Dining Out': '#F59E0B',
  'Coffee & Snacks': '#A16207',
  'Gas & Fuel': '#0EA5E9',
  'Public Transit': '#64748B',
  'Online Shopping': '#EC4899',
  'Clothing & Apparel': '#D946EF',
  'Streaming Services': '#7C3AED',
  'Mobile & Internet': '#2563EB',
  'Electric & Water': '#DC2626',
  'Rent & Mortgage': '#059669',
  'Medical & Dental': '#0891B2',
  'Gym & Fitness': '#4F46E5',
  'Tuition & Books': '#4338CA',
  'Bonus & Commission': '#16A34A',
  'Side Hustle': '#0D9488',
  'Stocks & Dividends': '#65A30D',
  'Crypto & Digital': '#CA8A04',
};

export function getCategoryIcon(category: string): IconName {
  return CATEGORY_ICONS[category] || 'credit-card';
}

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || '#64748B';
}

export function formatCurrency(amount: number | undefined | null, currency = '₱'): string {
  const value = typeof amount === 'number' && isFinite(amount) ? amount : 0;
  return `${currency}${value.toFixed(2)}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[parseInt(m, 10) - 1]} ${year}`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}