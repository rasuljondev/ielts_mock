import React, { useState, useRef, useEffect } from 'react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { GripVertical } from 'lucide-react';

export const TestingHelper: React.FC = () => {
  const { user } = useAuth();
  
  // Draggable state
  const [position, setPosition] = useState({ x: 16, y: 16 }); // Default top-right position
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Load saved position from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem('testing-helper-position');
    if (savedPosition) {
      try {
        setPosition(JSON.parse(savedPosition));
      } catch (error) {
        console.warn('Failed to load saved position:', error);
      }
    }
  }, []);

  // Save position to localStorage
  const savePosition = (newPosition: { x: number; y: number }) => {
    localStorage.setItem('testing-helper-position', JSON.stringify(newPosition));
  };

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

  // Drag event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // Only drag from the grip area
    
    setIsDragging(true);
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Constrain to viewport bounds
    const maxX = window.innerWidth - (cardRef.current?.offsetWidth || 300);
    const maxY = window.innerHeight - (cardRef.current?.offsetHeight || 200);

    const constrainedX = Math.max(0, Math.min(newX, maxX));
    const constrainedY = Math.max(0, Math.min(newY, maxY));

    setPosition({ x: constrainedX, y: constrainedY });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      savePosition(position);
    }
  };

  // Add/remove global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset, position]);

  return (
    <Card 
      ref={cardRef}
      className={`fixed shadow-lg z-50 border-2 border-blue-500 transition-shadow ${
        isDragging ? 'shadow-2xl' : 'shadow-lg'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
              <CardContent className="p-3 pt-8">
        {/* Drag handle */}
        <div
          className="absolute top-0 left-0 right-0 h-6 bg-blue-500 cursor-grab flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          onMouseDown={handleMouseDown}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <GripVertical className="h-4 w-4 text-white" />
        </div>
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
