import { ReactNode } from 'react';

import { QueryProvider } from './QueryProvider';
import { AuthProvider } from './AuthProvider';


interface Props {
  children: ReactNode;
}


export function AppProvider({
  children,
}: Props){

  return (
    <QueryProvider>

      <AuthProvider>

        {children}

      </AuthProvider>

    </QueryProvider>
  );
}