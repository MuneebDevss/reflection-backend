export function handleError(error: any, action: string) {
    let message = `Action failed while ${action}. An unexpected runtime problem occurred.`;

    if (error.message === 'AUTH_EXPIRED' || error.status === 401) {
      message = 'Authentication expired or access token revoked. Please reconnect the connector to authorize access.';
    } else if (error.code === 'P2025' || error.status === 404) {
      message = `No records matching your search scope were found while ${action}.`;
    } else if (error.message) {
      message = `Operation failed while ${action}: ${error.message}`;
    }

    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }