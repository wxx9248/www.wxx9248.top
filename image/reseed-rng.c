// reseed-rng: make the kernel reseed its random number generator now, from
// everything mixed into its input pool so far. A restored snapshot would
// otherwise give every visitor the same random bytes until the kernel's next
// timed reseed, several seconds later. Used by /usr/local/sbin/hostagent.
#include <fcntl.h>
#include <linux/random.h>
#include <stdio.h>
#include <sys/ioctl.h>

int main(void) {
	int fd = open("/dev/urandom", O_WRONLY);
	if (fd < 0 || ioctl(fd, RNDRESEEDCRNG) < 0) {
		perror("reseed-rng");
		return 1;
	}
	return 0;
}
