import { promises as dns } from 'dns';
import { performance } from 'perf_hooks';
import net from 'net';

class DNSResolver {
    constructor() {
        this.timeout = 5000;
        this.ipv6Available = null;
    }

    async checkIPv6Connectivity() {
        if (this.ipv6Available !== null) {
            return this.ipv6Available;
        }

        return new Promise((resolve) => {
            const socket = net.createConnection({
                host: '2001:4860:4860::8888',
                port: 53,
                family: 6,
                timeout: 2000
            });

            socket.on('connect', () => {
                socket.destroy();
                this.ipv6Available = true;
                resolve(true);
            });

            socket.on('error', () => {
                this.ipv6Available = false;
                resolve(false);
            });

            socket.on('timeout', () => {
                socket.destroy();
                this.ipv6Available = false;
                resolve(false);
            });
        });
    }

    async resolve(domain, server, type = 'A') {
        const startTime = performance.now();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        console.log(`[DNS] Request initiated: ${domain} (${type}) via ${server.name}`);
        
        const isIPv6Server = server.address.includes(':') && !server.address.startsWith('[');
        if (isIPv6Server) {
            const ipv6Available = await this.checkIPv6Connectivity();
            if (!ipv6Available) {
                const endTime = performance.now();
                const responseTime = endTime - startTime;
                
                console.warn(`[DNS] IPv6 not available: ${domain} (${type}) via ${server.name}`);
                
                return {
                    success: false,
                    responseTime: responseTime,
                    error: 'IPv6 connectivity is not available on this system. Please check your network configuration or use IPv4 DNS servers.',
                    server: server,
                    domain: domain,
                    type: type,
                    ipv6Status: 'unavailable'
                };
            }
        }
        
        try {
            const resolver = new dns.Resolver();
            
            let serverAddress;
            if (isIPv6Server) {
                serverAddress = `[${server.address}]:${server.port || 53}`;
            } else {
                serverAddress = `${server.address}:${server.port || 53}`;
            }
            
            console.log(`[DNS] Setting server address: ${serverAddress} for ${domain} (${type})`);
            resolver.setServers([serverAddress]);
            
            resolver.setTimeout(this.timeout);
            
            let result;
            switch (type.toLowerCase()) {
                case 'a':
                    result = await resolver.resolve4(domain);
                    break;
                case 'aaaa':
                    result = await resolver.resolve6(domain);
                    break;
                case 'mx':
                    result = await resolver.resolveMx(domain);
                    break;
                case 'txt':
                    result = await resolver.resolveTxt(domain);
                    break;
                case 'ns':
                    result = await resolver.resolveNs(domain);
                    break;
                case 'cname':
                    result = await resolver.resolveCname(domain);
                    break;
                default:
                    result = await resolver.resolve4(domain);
            }

            const endTime = performance.now();
            const responseTime = endTime - startTime;

            // Validate result structure
            if (!Array.isArray(result)) {
                console.warn(`[DNS] Invalid response: DNS result is not an array for ${domain} (${type}) via ${server.name}`);
            } else if (result.length === 0) {
                console.warn(`[DNS] Empty result for ${domain} (${type}) via ${server.name}`);
            }

            const finalResult = {
                success: true,
                responseTime: responseTime,
                result: result,
                server: server,
                domain: domain,
                type: type
            };

            console.log(`[DNS] Response successful: ${domain} (${type}) via ${server.name} - ${Math.round(responseTime * 100) / 100}ms`);
            return finalResult;
        } catch (error) {
            const endTime = performance.now();
            const responseTime = endTime - startTime;

            // Log detailed error information
            console.error(`[DNS] Resolution failed: ${domain} (${type}) via ${server.name} - ${error.message}`);

            const errorResult = {
                success: false,
                responseTime: responseTime,
                error: error.message,
                server: server,
                domain: domain,
                type: type
            };

            console.log(`[DNS] Response failed: ${domain} (${type}) via ${server.name} - ${Math.round(responseTime * 100) / 100}ms`);
            return errorResult;
        }
    }

    async resolveIPv4(domain, server) {
        return this.resolve(domain, server, 'A');
    }

    async resolveIPv6(domain, server) {
        return this.resolve(domain, server, 'AAAA');
    }

    setTimeout(timeout) {
        this.timeout = timeout;
    }
}

export default DNSResolver;