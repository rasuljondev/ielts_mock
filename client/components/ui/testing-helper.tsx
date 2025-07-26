import React from 'react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export const TestingHelper: React.FC = () => {
  const { user } = useAuth();

  const switchRole = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 200));

      // Determine which account to switch to
      // If currently admin, switch to student; if student (or not logged in), switch to admin
      const targetCredentials = user?.role === 'edu_admin'
        ? { email: 'rasuljon8218@gmail.com', password: '12345678', role: 'Student' }
        : { email: 'alisheykh8218@gmail.com', password: '12345678', role: 'Admin' };

      const { error } = await supabase.auth.signInWithPassword({
        email: targetCredentials.email,
        password: targetCredentials.password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error(`Account not found. Please check credentials.`);
        } else if (error.message.includes('Failed to fetch') || error.message.includes('chrome-extension')) {
          toast.error('Network issue detected. Please try again or refresh the page.');
        } else {
          toast.error(`Login failed: ${error.message}`);
        }
        console.error('Role switch error:', error);
      } else {
        toast.success(`Switched to ${targetCredentials.role} account!`);

        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (error) {
      console.error('Switch role error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('chrome-extension')) {
        toast.error('Network issue detected. Please try again or refresh the page.');
      } else {
        toast.error('Role switch failed. Please try again.');
      }
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Signed out successfully!');
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Sign out failed');
    }
  };

  return (
    <Card className="fixed top-4 right-4 shadow-lg z-50 border-2 border-blue-500">
      <CardContent className="p-3">
        {!user ? (
          <div className="space-y-2">
            <div className="text-xs text-gray-600 mb-2">Quick Login:</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={switchRole}
                className="text-xs"
              >
                Admin
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-gray-600">Logged in as:</div>
            <Badge variant={user.role === 'edu_admin' ? 'default' : 'secondary'}>
              {user.email}
            </Badge>
            <div className="text-xs text-gray-500">
              Role: {user.role === 'edu_admin' ? 'Admin' : 'Student'}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={switchRole}
                className="text-xs"
              >
                Switch to {user.role === 'edu_admin' ? 'Student' : 'Admin'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={signOut}
                className="text-xs"
              >
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
