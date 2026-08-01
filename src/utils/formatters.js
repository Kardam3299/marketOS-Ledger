import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

let activeCurrency = 'USD';

export const setActiveCurrency = (currency) => {
  activeCurrency = currency || 'USD';
};

export const resetActiveCurrency = () => {
  activeCurrency = 'USD';
};

export const formatCurrency = (amount, currency = activeCurrency) => {
  const numericAmount = Number(amount) || 0;
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || activeCurrency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(numericAmount);
};

export const formatDate = (date, format = 'YYYY-MM-DD') => {
  return dayjs(date).format(format);
};

export const formatDateLong = (date) => {
  return dayjs(date).format('MMM DD, YYYY');
};

export const formatDateTime = (date) => {
  return dayjs(date).format('MMM DD, YYYY HH:mm');
};

export const getDayOfWeek = (date) => {
  return dayjs(date).format('ddd');
};

export const getMonthName = (date) => {
  return dayjs(date).format('MMMM');
};

export const isToday = (date) => {
  return dayjs(date).isSame(dayjs(), 'day');
};

export const isThisMonth = (date) => {
  return dayjs(date).isSame(dayjs(), 'month');
};

export const isThisYear = (date) => {
  return dayjs(date).isSame(dayjs(), 'year');
};

export const getDaysInRange = (startDate, endDate) => {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const days = [];

  let current = start;
  while (current.isSameOrBefore(end)) {
    days.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }

  return days;
};

export const getWeeksInRange = (startDate, endDate) => {
  const start = dayjs(startDate).startOf('week');
  const end = dayjs(endDate).endOf('week');
  const weeks = [];

  let current = start;
  while (current.isSameOrBefore(end)) {
    weeks.push({
      start: current.format('YYYY-MM-DD'),
      end: current.endOf('week').format('YYYY-MM-DD'),
      label: `${current.format('MMM DD')} - ${current.endOf('week').format('MMM DD')}`,
    });
    current = current.add(1, 'week');
  }

  return weeks;
};

export const getMonthsInRange = (startDate, endDate) => {
  const start = dayjs(startDate).startOf('month');
  const end = dayjs(endDate).endOf('month');
  const months = [];

  let current = start;
  while (current.isSameOrBefore(end)) {
    months.push({
      start: current.format('YYYY-MM-DD'),
      end: current.endOf('month').format('YYYY-MM-DD'),
      label: current.format('MMMM YYYY'),
    });
    current = current.add(1, 'month');
  }

  return months;
};
