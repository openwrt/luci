#!/usr/bin/env perl

use strict;

sub git {
	my $res = undef;

	if (open my $git, '-|', 'git', @_) {
		{
			local $/;
			$res = readline $git;
		}

		chomp $res;
		close $git;
	}

	return $res;
}

my $release_branch = git(qw(rev-parse --abbrev-ref HEAD));
my $default_branch = system(qw(git show-ref --verify --quiet refs/heads/main)) ? 'master' : 'main';

if ($release_branch eq $default_branch) {
	printf STDERR "Please execute from a non-default branch\n";
	exit 1;
}

open my $cherry, '-|', 'git', 'cherry', '-v', $release_branch, $default_branch;

while (defined(my $line = readline $cherry)) {
	my ($id, $subject) = $line =~ m!^\+ ([a-f0-9]+) (.*)$!;
	next unless $id;

	my $found = git('log', '-1', '-E', "--grep=(backported|cherry picked) from commit $id");
	next if $found;

	my @files = split /\n/, git('show', '--pretty=format:', '--name-only', $id);
	next unless grep { !/\.pot?$/ } @files;

	print "$id $subject\n";
}

close $cherry;
