'use client';

import { useState } from 'react';

export default function SimpleTestLogin() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testLogin = async () => {
    setLoading(true);
    setResult(null);

    try {
      console.log('=== FRONTEND TEST STARTED ===');
      console.log('Calling /api/test-actual-login...');
      
      const response = await fetch('/api/test-actual-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'admin@dukaaon.in',
          password: 'dukaaon#28',
        }),
      });

      console.log('Response received:');
      console.log('- Status:', response.status);
      console.log('- OK:', response.ok);
      console.log('- Status Text:', response.statusText);
      console.log('- Headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('Response data:', data);
      console.log('Data type:', typeof data);
      console.log('Data keys:', Object.keys(data));
      console.log('data.success:', data.success);
      console.log('data.admin:', data.admin);

      setResult({
        step: 'API Response Received',
        status: response.status,
        ok: response.ok,
        data: data,
        analysis: {
          hasSuccess: 'success' in data,
          successValue: data.success,
          hasAdmin: 'admin' in data,
          hasError: 'error' in data,
          responseWasOk: response.ok,
          shouldLoginWork: response.ok && data.success && data.admin,
        },
      });

      // Now test if the actual validation function works
      console.log('\n=== TESTING ACTUAL VALIDATION FUNCTION ===');
      
      const { validateAdminCredentials } = await import('@/lib/supabase-browser');
      console.log('Imported validateAdminCredentials');
      
      try {
        const validationResult = await validateAdminCredentials('admin@dukaaon.in', 'dukaaon#28');
        console.log('Validation function result:', validationResult);
        
        setResult((prev: any) => ({
          ...prev,
          validationFunction: {
            result: validationResult,
            analysis: {
              hasSuccess: 'success' in validationResult,
              successValue: validationResult.success,
              hasAdmin: 'admin' in validationResult,
              hasError: 'error' in validationResult,
            },
          },
        }));
      } catch (validationError: any) {
        console.error('Validation function threw error:', validationError);
        setResult((prev: any) => ({
          ...prev,
          validationFunction: {
            error: validationError.message,
            stack: validationError.stack,
          },
        }));
      }

    } catch (error: any) {
      console.error('Frontend error:', error);
      setResult({
        step: 'Frontend Error',
        error: error.message,
        stack: error.stack,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Simple Login Test</h1>
      <p>This page will test the exact login flow and show you what's happening.</p>
      
      <button
        onClick={testLogin}
        disabled={loading}
        style={{
          padding: '1rem 2rem',
          fontSize: '1.1rem',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '2rem',
        }}
      >
        {loading ? 'Testing...' : 'Test Login Flow'}
      </button>

      {result && (
        <div style={{
          backgroundColor: '#f5f5f5',
          padding: '1rem',
          borderRadius: '4px',
          overflow: 'auto',
        }}>
          <h3>Result:</h3>
          <pre style={{ fontSize: '12px', lineHeight: '1.5' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
        <h4>What to Look For:</h4>
        <ul>
          <li><strong>status: 200</strong> - API response is OK</li>
          <li><strong>data.success: true</strong> - Backend validated credentials</li>
          <li><strong>data.admin:</strong> should contain admin object</li>
          <li><strong>validationFunction:</strong> should show same result</li>
        </ul>
        <p style={{ marginTop: '1rem' }}>
          <strong>Open browser console (F12) to see detailed logs!</strong>
        </p>
      </div>
    </div>
  );
}

