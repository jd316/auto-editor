'use client';

import { useState, FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button, Form, Alert, Card, Spinner } from 'react-bootstrap';

export default function AuthForm() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setLinkSent(false);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        throw error;
      }
      setMessage('Check your email for the sign-in link!');
      setLinkSent(true);
    } catch (error: any) {
      console.error('Error signing in:', error);
      setError(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDifferentEmail = () => {
    setLinkSent(false);
    setMessage('');
    setError('');
    setEmail('');
  }

  return (
    <Card className="mx-auto mt-5 auth-form-card">
      <Card.Body>
        <Card.Title className="text-center mb-4">
          {linkSent ? 'Check Your Email' : 'Sign In / Sign Up'}
        </Card.Title>
        {error && <Alert variant="danger">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}
        {!linkSent ? (
          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <Form.Label>Email address</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <Form.Text className="text-muted">
                We'll send a magic sign-in link to your email.
              </Form.Text>
            </Form.Group>

            <Button variant="primary" type="submit" className="w-100" disabled={loading}>
              {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Send Sign-In Link'}
            </Button>
          </Form>
        ) : (
          <div className="text-center">
            <p>A sign-in link has been sent to <strong>{email}</strong>.</p>
            <p>Please check your inbox (and spam folder) and click the link to sign in.</p>
            <Button variant="link" onClick={handleDifferentEmail} disabled={loading} className="mt-2">
              Use different email
            </Button>
          </div>
        )}
      </Card.Body>
    </Card>
  );
} 