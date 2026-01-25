'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Typography,
    TextField,
    IconButton,
    Avatar,
    InputAdornment,
    Badge,
    Divider,
    CircularProgress,
    Tooltip,
    Menu,
    MenuItem,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    Paper,
} from '@mui/material';
import {
    Search,
    Send,
    AttachFile,
    MoreVert,
    Done,
    DoneAll,
    Schedule,
    Error as ErrorIcon,
    Person,
    Phone,
    Videocam,
    InsertEmoticon,
    Mic,
    ArrowBack,
    Chat as ChatIcon,
    FilterList,
    Refresh,
    ContentCopy,
    Reply,
    Delete,
    Star,
    StarBorder,
    CheckCircle,
} from '@mui/icons-material';
import { format, formatDistanceToNow, isToday, isYesterday, isSameDay } from 'date-fns';
import { toast } from 'react-hot-toast';
import { getSupabaseClient } from '@/lib/supabase-browser';

// Types
interface Conversation {
    id: string;
    phone_number: string;
    user_id: string;
    user_role: string;
    last_message_at: string;
    last_message_content: string;
    last_message_direction: string;
    context: Record<string, any>;
    pending_action: string;
    pending_order_id: string;
    total_messages: number;
    ai_interactions: number;
    unread_count?: number;
    user_name?: string;
    profile_image?: string;
}

interface Message {
    id: string;
    phone_number: string;
    direction: 'inbound' | 'outbound';
    message_type: string;
    content: string;
    template_key: string;
    template_variables: Record<string, any>;
    related_order_id: string;
    related_user_id: string;
    ai_intent: string;
    ai_confidence: number;
    ai_response: string;
    language: string;
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    error_message: string;
    authkey_message_id: string;
    created_at: string;
    processed_at: string;
}

interface Template {
    id: string;
    template_key: string;
    template_name: string;
    authkey_template_id: string;
    category: string;
    description: string;
    variable_count: number;
    is_enabled: boolean;
}

// WhatsApp-style colors
const whatsappColors = {
    primary: '#00a884',
    primaryDark: '#008069',
    chatBg: '#efeae2',
    chatBgPattern: '#d9d2c5',
    outgoingBubble: '#d9fdd3',
    incomingBubble: '#ffffff',
    headerBg: '#f0f2f5',
    sidebarBg: '#ffffff',
    textPrimary: '#111b21',
    textSecondary: '#667781',
    timestamp: '#667781',
    tickBlue: '#53bdeb',
    tickGray: '#8696a0',
    inputBg: '#ffffff',
    divider: '#e9edef',
    hoverBg: '#f5f6f6',
    selectedBg: '#f0f2f5',
    unreadBadge: '#25d366',
};

// Message status icon
const MessageStatus = ({ status }: { status: string }) => {
    switch (status) {
        case 'pending':
            return <Schedule sx={{ fontSize: 16, color: whatsappColors.tickGray }} />;
        case 'sent':
            return <Done sx={{ fontSize: 16, color: whatsappColors.tickGray }} />;
        case 'delivered':
            return <DoneAll sx={{ fontSize: 16, color: whatsappColors.tickGray }} />;
        case 'read':
            return <DoneAll sx={{ fontSize: 16, color: whatsappColors.tickBlue }} />;
        case 'failed':
            return <ErrorIcon sx={{ fontSize: 16, color: '#f44336' }} />;
        default:
            return null;
    }
};

// Format message date
const formatMessageDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'dd/MM/yyyy');
};

// Format message time
const formatMessageTime = (dateStr: string) => {
    return format(new Date(dateStr), 'HH:mm');
};

// Format last seen time
const formatLastSeen = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return `today at ${format(date, 'HH:mm')}`;
    if (isYesterday(date)) return `yesterday at ${format(date, 'HH:mm')}`;
    return format(date, 'dd/MM/yyyy HH:mm');
};

export default function WhatsAppChat() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');

    // Template dialog
    const [templateDialog, setTemplateDialog] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

    // New chat dialog
    const [newChatDialog, setNewChatDialog] = useState(false);
    const [newChatPhone, setNewChatPhone] = useState('');

    // Context menu
    const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; message: Message } | null>(null);

    // Mobile view
    const [mobileShowChat, setMobileShowChat] = useState(false);

    // Scroll ref
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Fetch conversations
    const fetchConversations = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/whatsapp?type=conversations&limit=100');
            if (!response.ok) throw new Error('Failed to fetch conversations');
            const result = await response.json();
            setConversations(result.data || []);
        } catch (error) {
            console.error('Error fetching conversations:', error);
            toast.error('Failed to load conversations');
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch messages for a conversation
    const fetchMessages = useCallback(async (phoneNumber: string) => {
        setMessagesLoading(true);
        try {
            const response = await fetch(`/api/admin/whatsapp?type=messages&phone=${phoneNumber}&limit=100`);
            if (!response.ok) throw new Error('Failed to fetch messages');
            const result = await response.json();
            setMessages((result.data || []).reverse());
            setTimeout(scrollToBottom, 100);
        } catch (error) {
            console.error('Error fetching messages:', error);
            toast.error('Failed to load messages');
        } finally {
            setMessagesLoading(false);
        }
    }, []);

    // Fetch templates
    const fetchTemplates = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/whatsapp?type=templates');
            if (!response.ok) throw new Error('Failed to fetch templates');
            const result = await response.json();
            setTemplates((result.data || []).filter((t: Template) => t.is_enabled && t.authkey_template_id));
        } catch (error) {
            console.error('Error fetching templates:', error);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchConversations();
        fetchTemplates();
    }, [fetchConversations, fetchTemplates]);

    // Realtime subscription
    useEffect(() => {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        // Subscribe to new messages
        const messageSubscription = supabase
            .channel('whatsapp_chat_messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'whatsapp_messages'
            }, (payload: any) => {
                const newMessage = payload.new as Message;

                // If message belongs to selected conversation, add it
                if (selectedConversation && newMessage.phone_number === selectedConversation.phone_number) {
                    setMessages(prev => [...prev, newMessage]);
                    setTimeout(scrollToBottom, 100);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'whatsapp_messages'
            }, (payload: any) => {
                const updatedMessage = payload.new as Message;

                // Update message status in current view
                if (selectedConversation && updatedMessage.phone_number === selectedConversation.phone_number) {
                    setMessages(prev => prev.map(m => m.id === updatedMessage.id ? updatedMessage : m));
                }
            })
            .subscribe();

        // Subscribe to conversation updates
        const conversationSubscription = supabase
            .channel('whatsapp_chat_conversations')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'whatsapp_conversations'
            }, () => {
                // Refresh conversations list
                fetchConversations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(messageSubscription);
            supabase.removeChannel(conversationSubscription);
        };
    }, [selectedConversation, fetchConversations]);

    // Load messages when conversation selected
    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.phone_number);
        }
    }, [selectedConversation, fetchMessages]);

    // Select conversation
    const handleSelectConversation = (conv: Conversation) => {
        setSelectedConversation(conv);
        setMobileShowChat(true);
    };

    // Send message
    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedConversation) return;

        setSending(true);
        try {
            const response = await fetch('/api/admin/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_number: selectedConversation.phone_number,
                    message: newMessage.trim(),
                    message_type: 'text',
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to send message');
            }

            setNewMessage('');
            fetchMessages(selectedConversation.phone_number);
            fetchConversations();
            toast.success('Message sent');
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    // Send template message
    const handleSendTemplate = async () => {
        if (!selectedTemplate || !selectedConversation) return;

        setSending(true);
        try {
            const response = await fetch('/api/admin/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_number: selectedConversation.phone_number,
                    template_key: selectedTemplate.template_key,
                    variables: templateVariables,
                    message_type: 'template',
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to send template');
            }

            setTemplateDialog(false);
            setSelectedTemplate(null);
            setTemplateVariables({});
            fetchMessages(selectedConversation.phone_number);
            fetchConversations();
            toast.success('Template message sent');
        } catch (error) {
            console.error('Error sending template:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to send template');
        } finally {
            setSending(false);
        }
    };

    // Start new chat
    const handleStartNewChat = async () => {
        if (!newChatPhone.trim()) return;

        // Check if conversation already exists
        const existing = conversations.find(c => c.phone_number === newChatPhone);
        if (existing) {
            setSelectedConversation(existing);
            setNewChatDialog(false);
            setNewChatPhone('');
            setMobileShowChat(true);
            return;
        }

        // Create new conversation entry
        const newConv: Conversation = {
            id: `temp-${Date.now()}`,
            phone_number: newChatPhone,
            user_id: '',
            user_role: 'unknown',
            last_message_at: new Date().toISOString(),
            last_message_content: '',
            last_message_direction: 'outbound',
            context: {},
            pending_action: '',
            pending_order_id: '',
            total_messages: 0,
            ai_interactions: 0,
        };

        setSelectedConversation(newConv);
        setMessages([]);
        setNewChatDialog(false);
        setNewChatPhone('');
        setMobileShowChat(true);
    };

    // Copy message
    const handleCopyMessage = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
        setContextMenu(null);
    };

    // Filter conversations
    const filteredConversations = conversations.filter(conv => {
        const matchesSearch = searchQuery === '' ||
            conv.phone_number.includes(searchQuery) ||
            conv.last_message_content?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'all' || conv.user_role === roleFilter;
        return matchesSearch && matchesRole;
    });

    // Group messages by date
    const groupedMessages = messages.reduce((groups, message) => {
        const date = format(new Date(message.created_at), 'yyyy-MM-dd');
        if (!groups[date]) groups[date] = [];
        groups[date].push(message);
        return groups;
    }, {} as Record<string, Message[]>);

    return (
        <Box sx={{
            height: 'calc(100vh - 64px)',
            display: 'flex',
            bgcolor: whatsappColors.headerBg,
            overflow: 'hidden',
        }}>
            {/* Sidebar - Conversation List */}
            <Box sx={{
                width: { xs: mobileShowChat ? 0 : '100%', md: 400 },
                minWidth: { xs: mobileShowChat ? 0 : '100%', md: 400 },
                display: { xs: mobileShowChat ? 'none' : 'flex', md: 'flex' },
                flexDirection: 'column',
                bgcolor: whatsappColors.sidebarBg,
                borderRight: `1px solid ${whatsappColors.divider}`,
                overflow: 'hidden',
            }}>
                {/* Sidebar Header */}
                <Box sx={{
                    p: 2,
                    bgcolor: whatsappColors.headerBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: `1px solid ${whatsappColors.divider}`,
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: whatsappColors.primary, width: 40, height: 40 }}>
                            <ChatIcon />
                        </Avatar>
                        <Typography variant="h6" fontWeight="600" color={whatsappColors.textPrimary}>
                            Chats
                        </Typography>
                    </Box>
                    <Box>
                        <IconButton onClick={() => setNewChatDialog(true)}>
                            <ChatIcon />
                        </IconButton>
                        <IconButton onClick={fetchConversations}>
                            <Refresh />
                        </IconButton>
                    </Box>
                </Box>

                {/* Search & Filter */}
                <Box sx={{ p: 1.5, bgcolor: whatsappColors.headerBg }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search or start new chat"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search sx={{ color: whatsappColors.textSecondary }} />
                                </InputAdornment>
                            ),
                            sx: {
                                bgcolor: whatsappColors.inputBg,
                                borderRadius: 2,
                                '& fieldset': { border: 'none' },
                            }
                        }}
                    />
                    <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                        {['all', 'retailer', 'wholesaler', 'manufacturer'].map(role => (
                            <Chip
                                key={role}
                                label={role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1)}
                                size="small"
                                onClick={() => setRoleFilter(role)}
                                sx={{
                                    bgcolor: roleFilter === role ? whatsappColors.primary : 'transparent',
                                    color: roleFilter === role ? 'white' : whatsappColors.textSecondary,
                                    border: `1px solid ${roleFilter === role ? whatsappColors.primary : whatsappColors.divider}`,
                                    '&:hover': {
                                        bgcolor: roleFilter === role ? whatsappColors.primaryDark : whatsappColors.hoverBg,
                                    },
                                }}
                            />
                        ))}
                    </Box>
                </Box>

                {/* Conversation List */}
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress sx={{ color: whatsappColors.primary }} />
                        </Box>
                    ) : filteredConversations.length === 0 ? (
                        <Box sx={{ textAlign: 'center', p: 4, color: whatsappColors.textSecondary }}>
                            <ChatIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                            <Typography>No conversations found</Typography>
                        </Box>
                    ) : (
                        filteredConversations.map((conv) => (
                            <Box
                                key={conv.id}
                                onClick={() => handleSelectConversation(conv)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    p: 1.5,
                                    cursor: 'pointer',
                                    bgcolor: selectedConversation?.id === conv.id ? whatsappColors.selectedBg : 'transparent',
                                    '&:hover': { bgcolor: whatsappColors.hoverBg },
                                    borderBottom: `1px solid ${whatsappColors.divider}`,
                                }}
                            >
                                <Avatar sx={{
                                    bgcolor: whatsappColors.primary,
                                    width: 50,
                                    height: 50,
                                    mr: 1.5
                                }}>
                                    <Person />
                                </Avatar>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography
                                            variant="subtitle1"
                                            fontWeight="500"
                                            color={whatsappColors.textPrimary}
                                            noWrap
                                        >
                                            {conv.phone_number}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color={conv.unread_count ? whatsappColors.unreadBadge : whatsappColors.textSecondary}
                                        >
                                            {formatMessageTime(conv.last_message_at)}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                                            {conv.last_message_direction === 'outbound' && (
                                                <DoneAll sx={{ fontSize: 16, color: whatsappColors.tickBlue }} />
                                            )}
                                            <Typography
                                                variant="body2"
                                                color={whatsappColors.textSecondary}
                                                noWrap
                                                sx={{ flex: 1 }}
                                            >
                                                {conv.last_message_content || 'No messages yet'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                                            <Chip
                                                label={conv.user_role || '?'}
                                                size="small"
                                                sx={{
                                                    height: 18,
                                                    fontSize: 10,
                                                    bgcolor: whatsappColors.headerBg,
                                                    color: whatsappColors.textSecondary,
                                                }}
                                            />
                                            {conv.unread_count && conv.unread_count > 0 && (
                                                <Badge
                                                    badgeContent={conv.unread_count}
                                                    color="success"
                                                    sx={{ '& .MuiBadge-badge': { bgcolor: whatsappColors.unreadBadge } }}
                                                />
                                            )}
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                        ))
                    )}
                </Box>
            </Box>

            {/* Chat Area */}
            <Box sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: whatsappColors.chatBg,
                position: 'relative',
            }}>
                {selectedConversation ? (
                    <>
                        {/* Chat Header */}
                        <Box sx={{
                            p: 1.5,
                            bgcolor: whatsappColors.headerBg,
                            display: 'flex',
                            alignItems: 'center',
                            borderBottom: `1px solid ${whatsappColors.divider}`,
                        }}>
                            <IconButton
                                sx={{ display: { xs: 'flex', md: 'none' }, mr: 1 }}
                                onClick={() => setMobileShowChat(false)}
                            >
                                <ArrowBack />
                            </IconButton>
                            <Avatar sx={{ bgcolor: whatsappColors.primary, width: 40, height: 40, mr: 1.5 }}>
                                <Person />
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle1" fontWeight="500" color={whatsappColors.textPrimary}>
                                    {selectedConversation.phone_number}
                                </Typography>
                                <Typography variant="caption" color={whatsappColors.textSecondary}>
                                    {selectedConversation.user_role} • last seen {formatLastSeen(selectedConversation.last_message_at)}
                                </Typography>
                            </Box>
                            <Box>
                                <Tooltip title="Send Template">
                                    <IconButton onClick={() => setTemplateDialog(true)}>
                                        <AttachFile />
                                    </IconButton>
                                </Tooltip>
                                <IconButton>
                                    <MoreVert />
                                </IconButton>
                            </Box>
                        </Box>

                        {/* Messages Area */}
                        <Box
                            ref={messagesContainerRef}
                            sx={{
                                flex: 1,
                                overflowY: 'auto',
                                p: 2,
                                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d2c5' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                            }}
                        >
                            {messagesLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                    <CircularProgress sx={{ color: whatsappColors.primary }} />
                                </Box>
                            ) : messages.length === 0 ? (
                                <Box sx={{
                                    textAlign: 'center',
                                    p: 4,
                                    color: whatsappColors.textSecondary,
                                    bgcolor: 'rgba(255,255,255,0.8)',
                                    borderRadius: 2,
                                    mx: 'auto',
                                    maxWidth: 400,
                                    mt: 4,
                                }}>
                                    <ChatIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                                    <Typography variant="h6">No messages yet</Typography>
                                    <Typography variant="body2">
                                        Send a message to start the conversation
                                    </Typography>
                                </Box>
                            ) : (
                                Object.entries(groupedMessages).map(([date, dateMessages]) => (
                                    <Box key={date}>
                                        {/* Date Separator */}
                                        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                                            <Chip
                                                label={formatMessageDate(new Date(date))}
                                                size="small"
                                                sx={{
                                                    bgcolor: 'rgba(255,255,255,0.9)',
                                                    color: whatsappColors.textSecondary,
                                                    fontSize: 12,
                                                    fontWeight: 500,
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                                }}
                                            />
                                        </Box>

                                        {/* Messages */}
                                        {dateMessages.map((message) => (
                                            <Box
                                                key={message.id}
                                                sx={{
                                                    display: 'flex',
                                                    justifyContent: message.direction === 'outbound' ? 'flex-end' : 'flex-start',
                                                    mb: 0.5,
                                                }}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, message });
                                                }}
                                            >
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 1,
                                                        px: 1.5,
                                                        maxWidth: '65%',
                                                        minWidth: 80,
                                                        bgcolor: message.direction === 'outbound'
                                                            ? whatsappColors.outgoingBubble
                                                            : whatsappColors.incomingBubble,
                                                        borderRadius: 2,
                                                        borderTopRightRadius: message.direction === 'outbound' ? 0 : 8,
                                                        borderTopLeftRadius: message.direction === 'inbound' ? 0 : 8,
                                                        position: 'relative',
                                                        boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
                                                    }}
                                                >
                                                    {message.template_key && (
                                                        <Chip
                                                            label={message.template_key}
                                                            size="small"
                                                            sx={{ mb: 0.5, fontSize: 10, height: 18 }}
                                                        />
                                                    )}
                                                    <Typography
                                                        variant="body1"
                                                        sx={{
                                                            color: whatsappColors.textPrimary,
                                                            fontSize: 14.2,
                                                            lineHeight: 1.4,
                                                            whiteSpace: 'pre-wrap',
                                                            wordBreak: 'break-word',
                                                        }}
                                                    >
                                                        {message.content}
                                                    </Typography>
                                                    <Box sx={{
                                                        display: 'flex',
                                                        justifyContent: 'flex-end',
                                                        alignItems: 'center',
                                                        gap: 0.3,
                                                        mt: 0.3,
                                                    }}>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                color: whatsappColors.timestamp,
                                                                fontSize: 11,
                                                            }}
                                                        >
                                                            {formatMessageTime(message.created_at)}
                                                        </Typography>
                                                        {message.direction === 'outbound' && (
                                                            <MessageStatus status={message.status} />
                                                        )}
                                                    </Box>
                                                    {message.error_message && (
                                                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                                                            {message.error_message}
                                                        </Typography>
                                                    )}
                                                </Paper>
                                            </Box>
                                        ))}
                                    </Box>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </Box>

                        {/* Message Input */}
                        <Box sx={{
                            p: 1.5,
                            bgcolor: whatsappColors.headerBg,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                        }}>
                            <IconButton onClick={() => setTemplateDialog(true)}>
                                <InsertEmoticon sx={{ color: whatsappColors.textSecondary }} />
                            </IconButton>
                            <IconButton onClick={() => setTemplateDialog(true)}>
                                <AttachFile sx={{ color: whatsappColors.textSecondary, transform: 'rotate(45deg)' }} />
                            </IconButton>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Type a message"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                multiline
                                maxRows={4}
                                InputProps={{
                                    sx: {
                                        bgcolor: whatsappColors.inputBg,
                                        borderRadius: 2,
                                        '& fieldset': { border: 'none' },
                                    }
                                }}
                                disabled={sending}
                            />
                            <IconButton
                                onClick={handleSendMessage}
                                disabled={!newMessage.trim() || sending}
                                sx={{
                                    bgcolor: whatsappColors.primary,
                                    color: 'white',
                                    '&:hover': { bgcolor: whatsappColors.primaryDark },
                                    '&.Mui-disabled': { bgcolor: whatsappColors.divider }
                                }}
                            >
                                {sending ? <CircularProgress size={24} color="inherit" /> : <Send />}
                            </IconButton>
                        </Box>
                    </>
                ) : (
                    // Empty state - no conversation selected
                    <Box sx={{
                        flex: 1,
                        display: { xs: 'none', md: 'flex' },
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        bgcolor: whatsappColors.headerBg,
                        borderLeft: `1px solid ${whatsappColors.divider}`,
                    }}>
                        <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
                            <Box sx={{ mb: 4 }}>
                                <img
                                    src="https://web.whatsapp.com/img/intro-connection-light_c98cc75f2aa905314d74e0c3f5e7cb48.jpg"
                                    alt="WhatsApp"
                                    style={{ width: 320, opacity: 0.8 }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </Box>
                            <Typography variant="h5" color={whatsappColors.textPrimary} gutterBottom>
                                WhatsApp Admin Chat
                            </Typography>
                            <Typography variant="body1" color={whatsappColors.textSecondary}>
                                Select a conversation from the left to start messaging, or create a new chat.
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<ChatIcon />}
                                onClick={() => setNewChatDialog(true)}
                                sx={{
                                    mt: 3,
                                    bgcolor: whatsappColors.primary,
                                    '&:hover': { bgcolor: whatsappColors.primaryDark }
                                }}
                            >
                                Start New Chat
                            </Button>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Context Menu */}
            <Menu
                open={contextMenu !== null}
                onClose={() => setContextMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
            >
                <MenuItem onClick={() => handleCopyMessage(contextMenu?.message.content || '')}>
                    <ContentCopy sx={{ mr: 1, fontSize: 20 }} /> Copy
                </MenuItem>
                <MenuItem onClick={() => setContextMenu(null)}>
                    <Reply sx={{ mr: 1, fontSize: 20 }} /> Reply
                </MenuItem>
                <MenuItem onClick={() => setContextMenu(null)}>
                    <StarBorder sx={{ mr: 1, fontSize: 20 }} /> Star
                </MenuItem>
            </Menu>

            {/* New Chat Dialog */}
            <Dialog open={newChatDialog} onClose={() => setNewChatDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Start New Chat</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Phone Number"
                        placeholder="+91 9876543210"
                        value={newChatPhone}
                        onChange={(e) => setNewChatPhone(e.target.value)}
                        sx={{ mt: 1 }}
                        helperText="Enter the phone number with country code"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNewChatDialog(false)}>Cancel</Button>
                    <Button
                        onClick={handleStartNewChat}
                        variant="contained"
                        sx={{ bgcolor: whatsappColors.primary, '&:hover': { bgcolor: whatsappColors.primaryDark } }}
                    >
                        Start Chat
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Template Dialog */}
            <Dialog open={templateDialog} onClose={() => setTemplateDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Send Template Message</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Select Template</InputLabel>
                        <Select
                            value={selectedTemplate?.template_key || ''}
                            onChange={(e) => {
                                const template = templates.find(t => t.template_key === e.target.value);
                                setSelectedTemplate(template || null);
                                setTemplateVariables({});
                            }}
                            label="Select Template"
                        >
                            {templates.map((template) => (
                                <MenuItem key={template.id} value={template.template_key}>
                                    <Box>
                                        <Typography variant="subtitle2">{template.template_name}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {template.category} • {template.variable_count} variables
                                        </Typography>
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {selectedTemplate && selectedTemplate.variable_count > 0 && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Template Variables
                            </Typography>
                            {Array.from({ length: selectedTemplate.variable_count }, (_, i) => (
                                <TextField
                                    key={i}
                                    fullWidth
                                    size="small"
                                    label={`Variable ${i + 1}`}
                                    value={templateVariables[`var${i + 1}`] || ''}
                                    onChange={(e) => setTemplateVariables(prev => ({
                                        ...prev,
                                        [`var${i + 1}`]: e.target.value
                                    }))}
                                    sx={{ mb: 1 }}
                                />
                            ))}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTemplateDialog(false)}>Cancel</Button>
                    <Button
                        onClick={handleSendTemplate}
                        variant="contained"
                        disabled={!selectedTemplate || sending}
                        sx={{ bgcolor: whatsappColors.primary, '&:hover': { bgcolor: whatsappColors.primaryDark } }}
                    >
                        {sending ? <CircularProgress size={20} /> : 'Send Template'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
